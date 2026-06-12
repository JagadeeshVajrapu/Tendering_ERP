import mongoose, { Document, Schema, Types } from 'mongoose';
import { ValidatedMasterDatasetParameter, ValidatedMasterDatasetStatistics } from '../types/validatedMasterDataset';

export interface IDocumentMasterTenderDataset extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  parameters: ValidatedMasterDatasetParameter[];
  statistics: ValidatedMasterDatasetStatistics;
  builtAt: Date;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const parameterSchema = new Schema(
  {
    parameter: { type: String, required: true },
    value: { type: String, required: true },
    page: { type: Number, required: true },
    confidence: { type: Number, default: 0 },
    sourceText: { type: String, default: '' },
    validationStatus: { type: String, enum: ['validated', 'review', 'rejected', 'pending'], default: 'validated' },
    category: { type: String, default: '' },
    parameterType: { type: String, enum: ['core', 'dynamic'], default: 'core' },
    canonicalKey: { type: String, default: '' },
    originalLabel: { type: String, default: '' },
  },
  { _id: false }
);

const schema = new Schema<IDocumentMasterTenderDataset>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    parameters: { type: [parameterSchema], default: [] },
    statistics: {
      totalParameters: { type: Number, default: 0 },
      validatedCount: { type: Number, default: 0 },
      coreCount: { type: Number, default: 0 },
      dynamicCount: { type: Number, default: 0 },
      averageConfidence: { type: Number, default: 0 },
      categoryCounts: { type: Schema.Types.Mixed, default: {} },
    },
    builtAt: { type: Date, default: Date.now },
    schemaVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: 'document_master_tender_datasets',
  }
);

export const DocumentMasterTenderDataset = mongoose.model<IDocumentMasterTenderDataset>(
  'DocumentMasterTenderDataset',
  schema
);
