import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { FeasibilityReport } from '../../models/FeasibilityReport';
import { feasibilityReportRepository } from '../../repositories/tenderRepository';
import { tenderRepository } from '../../repositories/tenderRepository';
import { TenderStatus } from '../../types';
import { enterpriseMasterDatasetAccess } from '../masterTenderDataset/enterpriseMasterDatasetAccess';
import { dynamicChecklistService } from '../dynamicChecklist/dynamicChecklistService';
import { tenderRiskAnalysisService } from '../risk/tenderRiskAnalysisService';
import { buildEnterpriseFeasibilityReport } from './enterpriseFeasibilityReportBuilder';
import { enterpriseFeasibilityPdfService } from './enterpriseFeasibilityPdfService';
import { fileStorageService } from '../storage/fileStorageService';
import { EnterpriseFeasibilityReport } from '../../types/enterpriseFeasibilityReport';

class EnterpriseFeasibilityReportService {
  async buildReport(tenderId: string, userId?: Types.ObjectId): Promise<EnterpriseFeasibilityReport> {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) throw new AppError('No document found for this tender.', 404);

    const [master, checklist, riskResult] = await Promise.all([
      enterpriseMasterDatasetAccess.getMasterDataset(document._id, document.tenderId),
      dynamicChecklistService.generateAndStore(document._id, document.tenderId),
      tenderRiskAnalysisService.getOrAnalyzeForTender(tender._id),
    ]);

    if (!master.parameters.length) {
      throw new AppError('Master dataset not ready. Complete extraction pipeline first.', 400);
    }

    const risk = {
      risks: riskResult.risks.map((r) => ({
        riskType: r.riskType,
        level: r.level,
        reason: r.reason,
        confidence: r.confidence,
      })),
      overallLevel: riskResult.overallLevel,
      prerequisites: riskResult.prerequisites,
      dataSource: 'master_dataset' as const,
      processingTimeMs: riskResult.processingTimeMs,
    };

    return buildEnterpriseFeasibilityReport({
      tenderId,
      documentId: String(document._id),
      serviceCategory: master.serviceCategory || checklist.serviceCategory,
      masterParameters: master.parameters,
      checklist,
      risk,
      generatedBy: userId ? String(userId) : undefined,
    });
  }

  async generateAndStore(tenderId: string, userId: Types.ObjectId) {
    const enterprise = await this.buildReport(tenderId, userId);
    const pdfBuffer = await enterpriseFeasibilityPdfService.generatePdf(enterprise);
    const saved = await fileStorageService.saveReportPdf(pdfBuffer, tenderId);

    const legacyRecommendation =
      enterprise.aiRecommendation.recommendation === 'Not Recommended' ||
      enterprise.aiRecommendation.recommendation === 'High Risk'
        ? ('Not Suitable' as const)
        : ('Suitable' as const);

    const report = await feasibilityReportRepository.create({
      tenderId: new Types.ObjectId(tenderId),
      analysisId: new Types.ObjectId(tenderId),
      generatedBy: userId,
      scopeSummary: enterprise.scopeSummary.bullets.map((b) => `• ${b}`).join('\n'),
      eligibilitySummary: [
        enterprise.eligibilitySummary.turnoverRequirement &&
          `Turnover: ${enterprise.eligibilitySummary.turnoverRequirement}`,
        enterprise.eligibilitySummary.experienceRequirement &&
          `Experience: ${enterprise.eligibilitySummary.experienceRequirement}`,
        `Status: ${enterprise.experienceMatching.eligibilityStatus}`,
      ]
        .filter(Boolean)
        .join('\n'),
      timelineSummary: [
        enterprise.timelineSummary.bidEndDate &&
          `Bid End: ${enterprise.timelineSummary.bidEndDate}`,
        enterprise.timelineSummary.daysRemaining !== null &&
          `Days Remaining: ${enterprise.timelineSummary.daysRemaining}`,
      ]
        .filter(Boolean)
        .join('\n'),
      financialSummary: `Tender Value: ${enterprise.financialSummary.tenderValue} · EMD: ${enterprise.financialSummary.emd} · Exposure: ${enterprise.financialSummary.estimatedFinancialExposure}`,
      keyRisks: enterprise.riskAnalysis.risks
        .filter((r) => r.level === 'High' || r.level === 'Medium')
        .map((r) => `${r.riskType} (${r.level}): ${r.reason}`),
      recommendation: legacyRecommendation,
      intelligenceRecommendation: enterprise.aiRecommendation.recommendation,
      recommendationJustification: enterprise.aiRecommendation.reason,
      eligibilityStatus: enterprise.experienceMatching.eligibilityStatus,
      executiveReport: {
        overviewLines: [
          `${enterprise.overview.tenderTitle || 'Tender'}`,
          enterprise.overview.organization && `Organization: ${enterprise.overview.organization}`,
          enterprise.overview.tenderValue && `Value: ${enterprise.overview.tenderValue}`,
          enterprise.overview.serviceCategory && `Category: ${enterprise.overview.serviceCategory}`,
        ].filter(Boolean) as string[],
        scopeBullets: enterprise.scopeSummary.bullets,
        eligibilityBullets: enterprise.eligibilitySummary.mandatoryCertifications,
        eligibilityStatus: enterprise.experienceMatching.eligibilityStatus,
        timelineRows: [
          { milestone: 'Bid End', date: enterprise.timelineSummary.bidEndDate || '—' },
          {
            milestone: 'Days Remaining',
            date:
              enterprise.timelineSummary.daysRemaining !== null
                ? String(enterprise.timelineSummary.daysRemaining)
                : '—',
          },
        ],
        recommendation: enterprise.aiRecommendation.recommendation,
        recommendationJustification: enterprise.aiRecommendation.reason,
      },
      pdfPath: saved.relativePath,
      pdfFileName: saved.fileName,
      schemaVersion: enterprise.schemaVersion,
      approvalStatus: 'draft',
      decisionHistory: [],
      enterpriseReport: enterprise,
    });

    await tenderRepository.setStatus(tenderId, TenderStatus.SUMMARY_GENERATED, 'MD Report Generated');

    console.log('[EnterpriseFeasibility] Generated', {
      tenderId,
      recommendation: enterprise.aiRecommendation.recommendation,
      readiness: enterprise.checklistReadiness.readinessLabel,
    });

    return {
      report,
      enterprise,
      pdfUrl: fileStorageService.getPublicUrl(saved.relativePath),
    };
  }

  async getLatest(tenderId: string) {
    const report = await FeasibilityReport.findOne({ tenderId }).sort({ createdAt: -1 }).lean();
    if (!report) throw new AppError('Feasibility report not found. Generate MD report first.', 404);

    const tender = await tenderRepository.findById(tenderId);
    const enterprise = (report as { enterpriseReport?: EnterpriseFeasibilityReport }).enterpriseReport;

    return {
      report,
      enterprise,
      pdfUrl: fileStorageService.getPublicUrl(report.pdfPath),
      tender,
    };
  }
}

export const enterpriseFeasibilityReportService = new EnterpriseFeasibilityReportService();
