import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { IntelligenceJob } from '../../models/IntelligenceJob';
import { TenderMasterDataset } from '../../models/TenderMasterDataset';
import { TenderRiskAnalysis } from '../../models/TenderRiskAnalysis';
import { TenderExecutiveRecommendation } from '../../models/TenderExecutiveRecommendation';
import { MasterTenderDataset, MasterDatasetStatistics } from '../../types/masterDataset';
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { tenderRiskAnalysisService } from '../risk/tenderRiskAnalysisService';
import { executiveRecommendationEngine } from './executiveRecommendationEngine';
import { ExecutiveRecommendationResult } from '../../types/executiveRecommendation';
import { TenderRiskAnalysisResult } from '../../types/tenderRiskAnalysis';

export interface ExecutiveRecommendationStoreContext {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class TenderExecutiveRecommendationService {
  async loadVerifiedInputs(documentId: Types.ObjectId) {
    const [masterRecord, riskRecord] = await Promise.all([
      TenderMasterDataset.findOne({ documentId }),
      TenderRiskAnalysis.findOne({ documentId }),
    ]);

    if (!masterRecord) {
      throw new AppError('Master dataset not found. Complete extraction and validation first.', 400);
    }
    if (!riskRecord) {
      throw new AppError('Risk analysis not found. Complete risk analysis before generating recommendation.', 400);
    }

    const riskAnalysis: TenderRiskAnalysisResult = {
      risks: riskRecord.risks,
      overallLevel: riskRecord.overallLevel,
      prerequisites: riskRecord.prerequisites,
      dataSource: 'master_dataset',
      processingTimeMs: riskRecord.processingTimeMs,
    };

    return {
      dataset: masterRecord.dataset,
      statistics: masterRecord.statistics,
      riskAnalysis,
    };
  }

  generate(
    dataset: MasterTenderDataset,
    statistics: MasterDatasetStatistics,
    riskAnalysis: TenderRiskAnalysisResult
  ): ExecutiveRecommendationResult {
    return executiveRecommendationEngine.generate(dataset, statistics, riskAnalysis);
  }

  async generateAndStore(ctx: ExecutiveRecommendationStoreContext): Promise<ExecutiveRecommendationResult> {
    const inputs = await this.loadVerifiedInputs(ctx.documentId);
    const result = this.generate(inputs.dataset, inputs.statistics, inputs.riskAnalysis);

    await TenderExecutiveRecommendation.findOneAndUpdate(
      { documentId: ctx.documentId },
      {
        $set: {
          tenderId: ctx.tenderId,
          documentId: ctx.documentId,
          jobId: ctx.jobId,
          recommendation: result.recommendation,
          executiveSummary: result.executiveSummary,
          factors: result.factors,
          overallRiskLevel: result.overallRiskLevel,
          dataQualityScore: result.dataQualityScore,
          dataSource: 'master_dataset',
          processingTimeMs: result.processingTimeMs,
          schemaVersion: 1,
        },
      },
      { upsert: true, new: true }
    );

    return result;
  }

  async getByDocumentId(documentId: Types.ObjectId) {
    return TenderExecutiveRecommendation.findOne({ documentId });
  }

  async getOrGenerateForTender(tenderId: Types.ObjectId) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) throw new AppError('No document found for this tender.', 404);

    const existing = await this.getByDocumentId(document._id);
    if (existing) {
      return { ...this.formatResponse(tender, document, existing), stored: true as const };
    }

    const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });

    await masterDatasetService.getOrBuildByDocumentId(document._id, document.tenderId, job?._id);

    const riskExists = await TenderRiskAnalysis.findOne({ documentId: document._id });
    if (!riskExists) {
      await tenderRiskAnalysisService.analyzeAndStore({
        tenderId: tender._id,
        documentId: document._id,
        jobId: job?._id,
      });
    }

    const result = await this.generateAndStore({
      tenderId: tender._id,
      documentId: document._id,
      jobId: job?._id,
    });

    const record = await this.getByDocumentId(document._id);
    if (!record) throw new AppError('Failed to store executive recommendation', 500);

    return { ...this.formatResponse(tender, document, record), stored: false as const };
  }

  private formatResponse(
    tender: { _id: Types.ObjectId },
    document: { _id: Types.ObjectId; originalName?: string },
    record: {
      recommendation: ExecutiveRecommendationResult['recommendation'];
      executiveSummary: string;
      factors: ExecutiveRecommendationResult['factors'];
      overallRiskLevel: ExecutiveRecommendationResult['overallRiskLevel'];
      dataQualityScore: number;
      dataSource: 'master_dataset';
      processingTimeMs: number;
      updatedAt?: Date;
    }
  ) {
    return {
      tenderId: String(tender._id),
      documentId: String(document._id),
      originalName: document.originalName,
      recommendation: record.recommendation,
      executiveSummary: record.executiveSummary,
      factors: record.factors,
      overallRiskLevel: record.overallRiskLevel,
      dataQualityScore: record.dataQualityScore,
      dataSource: record.dataSource,
      processingTimeMs: record.processingTimeMs,
      generatedAt: record.updatedAt?.toISOString(),
    };
  }
}

export const tenderExecutiveRecommendationService = new TenderExecutiveRecommendationService();
