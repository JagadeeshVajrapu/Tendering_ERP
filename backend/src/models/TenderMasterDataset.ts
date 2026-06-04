import mongoose, { Document, Schema, Types } from 'mongoose';
import { MasterDatasetKey, MasterTenderDataset, MasterDatasetStatistics, MasterDatasetProvenance } from '../types/masterDataset';

const masterFieldSchema = new Schema(
  {
    value: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    sourcePage: { type: Number, default: 0 },
    sourceText: { type: String, default: '' },
  },
  { _id: false }
);

export interface ITenderMasterDataset extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId?: Types.ObjectId;
  dataset: MasterTenderDataset;
  statistics: MasterDatasetStatistics;
  provenance: MasterDatasetProvenance;
  schemaVersion: number;
}

const tenderMasterDatasetSchema = new Schema<ITenderMasterDataset>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    dataset: {
      type: Schema.Types.Mixed,
      required: true,
    },
    statistics: {
      totalFields: { type: Number, default: 0 },
      populatedFields: { type: Number, default: 0 },
      averageConfidence: { type: Number, default: 0 },
      lowConfidenceFields: { type: Number, default: 0 },
      processingTimeMs: { type: Number, default: 0 },
    },
    provenance: {
      ocrPageCount: { type: Number, default: 0 },
      ruleExtractedCount: { type: Number, default: 0 },
      validatedCount: { type: Number, default: 0 },
      aiVerifiedCount: { type: Number, default: 0 },
      confidenceScoredCount: { type: Number, default: 0 },
    },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

tenderMasterDatasetSchema.index({ tenderId: 1, documentId: 1 }, { unique: true });
tenderMasterDatasetSchema.index({ documentId: 1 }, { unique: true });

export const TenderMasterDataset = mongoose.model<ITenderMasterDataset>(
  'TenderMasterDataset',
  tenderMasterDatasetSchema
);

export type { MasterDatasetKey, MasterTenderDataset };
