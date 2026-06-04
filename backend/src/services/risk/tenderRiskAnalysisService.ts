import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { IntelligenceJob } from '../../models/IntelligenceJob';
import { MasterTenderDataset } from '../../types/masterDataset';
import { TenderMasterDataset } from '../../models/TenderMasterDataset';
import { TenderRiskAnalysis } from '../../models/TenderRiskAnalysis';
import { DocumentNitExtractedField } from '../../models/DocumentNitExtractedField';
import { DocumentFieldValidation } from '../../models/DocumentFieldValidation';
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { masterDatasetRiskEngine } from './masterDatasetRiskEngine';
import { TenderRiskAnalysisResult, TenderRiskPrerequisites } from '../../types/tenderRiskAnalysis';

export interface TenderRiskAnalysisStoreContext {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class TenderRiskAnalysisService {
  async checkPrerequisites(documentId: Types.ObjectId): Promise<TenderRiskPrerequisites> {
    const [extractedCount, validatedCount, masterRecord] = await Promise.all([
      DocumentNitExtractedField.countDocuments({ documentId }),
      DocumentFieldValidation.countDocuments({ documentId, valid: true }),
      TenderMasterDataset.findOne({ documentId }),
    ]);

    return {
      extractionComplete: extractedCount > 0,
      validationComplete: validatedCount > 0,
      masterDatasetReady: !!masterRecord,
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
    console.log('[RiskAnalysis] Start — master dataset only');
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

    const masterRecord = await TenderMasterDataset.findOne({ documentId: ctx.documentId });
    if (!masterRecord) {
      throw new AppError('Master dataset not found. Complete extraction pipeline first.', 400);
    }

    const result = await this.analyzeFromMasterDataset(masterRecord.dataset, prerequisites);

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

    // Ensure master dataset exists before risk analysis
    await masterDatasetService.getOrBuildByDocumentId(
      document._id,
      document.tenderId,
      job?._id
    );

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
