import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { pdfService } from './pdfService';
import { fileStorageService } from '../storage/fileStorageService';
import {
  tenderAnalysisRepository,
  feasibilityReportRepository,
} from '../../repositories/tenderRepository';
import { TenderStatus } from '../../types';
import { tenderRepository } from '../../repositories/tenderRepository';
import { TenderIntelligence } from '../../models/TenderIntelligence';
import { buildMdFeasibilityContent } from './mdFeasibilityReportBuilder';

class FeasibilityReportService {
  /**
   * Generate basic MD feasibility brief from completed tender intelligence
   * (uploaded document extraction — scope, eligibility, timeline + key facts).
   */
  async generateReport(tenderId: string, userId: Types.ObjectId) {
    const intelligence = await TenderIntelligence.findOne({
      tenderId: new Types.ObjectId(tenderId),
      phase: 'complete',
    }).sort({ createdAt: -1 });

    if (!intelligence) {
      throw new AppError(
        'Tender analysis not complete. Upload the document and wait for analysis to finish.',
        400
      );
    }

    const content = buildMdFeasibilityContent(intelligence);

    const analysis =
      (await tenderAnalysisRepository.findLatestByTender(tenderId)) ||
      (await tenderAnalysisRepository.create({
        tenderId: new Types.ObjectId(tenderId),
        documentId: intelligence.documentId,
        analyzedBy: userId,
        tenderName: content.tenderTitle,
        department: '',
        organization: content.organization,
        tenderNumber: content.tenderNumber,
        estimatedValue: '',
        emdAmount: '',
        bgRequirement: '',
        bidSubmissionDate: '',
        preBidMeetingDate: '',
        contractDuration: '',
        scopeOfWork: content.scopeSummary,
        eligibilityCriteria: [],
        requiredDocuments: [],
        technicalRequirements: [],
        reverseAuction: 'No',
        mafRequired: 'No',
        importantDates: [],
        paymentTerms: '',
        riskFactors: content.keyRisks,
        aiRecommendation: content.intelligenceRecommendation,
      }));

    const pdfBuffer = await pdfService.generateMdFeasibilityBrief(content);
    const saved = await fileStorageService.saveReportPdf(pdfBuffer, tenderId);

    const ex = content.executive;
    const report = await feasibilityReportRepository.create({
      tenderId: new Types.ObjectId(tenderId),
      analysisId: analysis._id,
      generatedBy: userId,
      scopeSummary: content.scopeSummary,
      eligibilitySummary: content.eligibilitySummary,
      timelineSummary: content.timelineSummary,
      financialSummary: content.financialSummary,
      keyRisks: content.keyRisks,
      recommendation: content.recommendation,
      intelligenceRecommendation: content.intelligenceRecommendation,
      recommendationJustification: content.recommendationJustification,
      eligibilityStatus: ex.eligibilityStatus,
      executiveReport: {
        overviewLines: ex.overviewLines,
        scopeBullets: ex.scopeBullets,
        eligibilityBullets: ex.eligibilityBullets,
        eligibilityStatus: ex.eligibilityStatus,
        timelineRows: ex.timelineRows,
        recommendation: ex.recommendation,
        recommendationJustification: ex.recommendationJustification,
      },
      pdfPath: saved.relativePath,
      pdfFileName: saved.fileName,
    });

    await tenderRepository.setStatus(tenderId, TenderStatus.SUMMARY_GENERATED, 'MD Report Generated');

    return {
      report,
      pdfUrl: fileStorageService.getPublicUrl(saved.relativePath),
    };
  }

  async getLatestReport(tenderId: string) {
    const report = await feasibilityReportRepository.findLatestByTender(tenderId);
    if (!report) throw new AppError('Feasibility report not found. Generate MD report first.', 404);

    const tender = await tenderRepository.findById(tenderId);

    return {
      report,
      pdfUrl: fileStorageService.getPublicUrl(report.pdfPath),
      tender,
    };
  }
}

export const feasibilityReportService = new FeasibilityReportService();
