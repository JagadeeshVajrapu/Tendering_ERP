import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { IntelligenceJob } from '../../models/IntelligenceJob';
import { MasterTenderDataset } from '../../types/masterDataset';
import { TenderRiskAnalysis } from '../../models/TenderRiskAnalysis';
import { EnterpriseMasterDatasetParameter } from '../../models/EnterpriseMasterDatasetParameter';
import { enterpriseMasterDatasetAccess } from '../masterTenderDataset/enterpriseMasterDatasetAccess';
import { masterDatasetRiskEngine } from './masterDatasetRiskEngine';
import { TenderRiskAnalysisResult, TenderRiskPrerequisites } from '../../types/tenderRiskAnalysis';

export interface TenderRiskAnalysisStoreContext {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class TenderRiskAnalysisService {
  async checkPrerequisites(documentId: Types.ObjectId): Promise<TenderRiskPrerequisites> {
    const paramCount = await EnterpriseMasterDatasetParameter.countDocuments({ documentId });
    const ready = paramCount > 0;

    return {
      extractionComplete: ready,
      validationComplete: ready,
      masterDatasetReady: ready,
    };
  }

  async assertPrerequisites(documentId: Types.ObjectId): Promise<TenderRiskPrerequisites> {
    const prereq = await this.checkPrerequisites(documentId);
    try {
      masterDatasetRiskEngine.assertPrerequisites(prereq);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : 'Prerequisites not met', 400);
    }
    return prereq;
  }

  async analyzeFromMasterDataset(
    dataset: MasterTenderDataset,
    prerequisites: TenderRiskPrerequisites
  ): Promise<TenderRiskAnalysisResult> {
    console.log('[RiskAnalysis] Start — enterprise master dataset only');
    const result = masterDatasetRiskEngine.analyze(dataset, prerequisites);
    console.log('[RiskAnalysis] End', {
      overallLevel: result.overallLevel,
      processingTimeMs: result.processingTimeMs,
      risks: result.risks.map((r) => ({ type: r.riskType, level: r.level, confidence: r.confidence })),
    });
    return result;
  }

  async analyzeAndStore(ctx: TenderRiskAnalysisStoreContext): Promise<TenderRiskAnalysisResult> {
    const prerequisites = await this.assertPrerequisites(ctx.documentId);

    const dataset = await enterpriseMasterDatasetAccess.getKeyedDataset(
      ctx.documentId,
      ctx.tenderId
    );

    const result = await this.analyzeFromMasterDataset(dataset, prerequisites);

    await TenderRiskAnalysis.findOneAndUpdate(
      { documentId: ctx.documentId },
      {
        $set: {
          tenderId: ctx.tenderId,
          documentId: ctx.documentId,
          jobId: ctx.jobId,
          risks: result.risks,
          overallLevel: result.overallLevel,
          prerequisites: result.prerequisites,
          dataSource: 'enterprise_master_dataset',
          processingTimeMs: result.processingTimeMs,
          schemaVersion: 2,
        },
      },
      { upsert: true, new: true }
    );

    return result;
  }

  async getByDocumentId(documentId: Types.ObjectId) {
    return TenderRiskAnalysis.findOne({ documentId });
  }

  async getOrAnalyzeForTender(tenderId: Types.ObjectId) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) throw new AppError('No document found for this tender.', 404);

    const existing = await this.getByDocumentId(document._id);
    if (existing) {
      return {
        tenderId: String(tender._id),
        documentId: String(document._id),
        originalName: document.originalName,
        risks: existing.risks,
        overallLevel: existing.overallLevel,
        prerequisites: existing.prerequisites,
        dataSource: existing.dataSource,
        processingTimeMs: existing.processingTimeMs,
        generatedAt: existing.updatedAt?.toISOString(),
        stored: true as const,
      };
    }

    const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });

    await enterpriseMasterDatasetAccess.getMasterDataset(document._id, document.tenderId, {
      refresh: false,
    });

    const result = await this.analyzeAndStore({
      tenderId: tender._id,
      documentId: document._id,
      jobId: job?._id,
    });

    const record = await this.getByDocumentId(document._id);

    return {
      tenderId: String(tender._id),
      documentId: String(document._id),
      originalName: document.originalName,
      risks: result.risks,
      overallLevel: result.overallLevel,
      prerequisites: result.prerequisites,
      dataSource: result.dataSource,
      processingTimeMs: result.processingTimeMs,
      generatedAt: record?.updatedAt?.toISOString() || new Date().toISOString(),
      stored: false as const,
    };
  }
}

export const tenderRiskAnalysisService = new TenderRiskAnalysisService();
