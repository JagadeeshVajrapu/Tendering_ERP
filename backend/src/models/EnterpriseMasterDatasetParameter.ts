import mongoose, { Document, Schema, Types } from 'mongoose';

const duplicateSchema = new Schema(
  {
    value: { type: String, default: '' },
    pageNumber: { type: Number, default: 0 },
    pagePriority: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    rankingScore: { type: Number, default: 0 },
    sourceText: { type: String, default: '' },
    validationStatus: { type: String, default: '' },
  },
  { _id: false }
);

export interface IEnterpriseMasterDatasetParameter extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  parameter: string;
  normalizedParameter: string;
  value: string;
  category: string;
  serviceCategory: string;
  pageNumber: number;
  pagePriority?: number;
  confidence: number;
  validationStatus: string;
  isCoreParameter: boolean;
  sourceText: string;
  sourceSection: string;
  rankingScore: number;
  validationReason: string;
  rankingReason: string;
  canonicalKey: string;
  parameterType: 'core' | 'dynamic';
  duplicateHistory: Array<{
    value: string;
    pageNumber: number;
    pagePriority?: number;
    confidence: number;
    rankingScore: number;
    sourceText: string;
    validationStatus?: string;
  }>;
  tenderType?: string;
  source?: string;
  verificationStatus?: 'VERIFIED' | 'REVIEW' | 'REJECT';
  verificationConfidence?: number;
  verificationReason?: string;
  verificationScores?: Record<string, number>;
  verificationAiEvaluated?: boolean;
  datasetVersion: number;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IEnterpriseMasterDatasetParameter>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    parameter: { type: String, required: true, index: true },
    normalizedParameter: { type: String, default: '' },
    value: { type: String, required: true },
    category: { type: String, default: '' },
    serviceCategory: { type: String, default: '' },
    pageNumber: { type: Number, required: true },
    pagePriority: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    validationStatus: {
      type: String,
      enum: ['VALID', 'VALID_DYNAMIC_PARAMETER', 'REVIEW', 'REJECT'],
      default: 'VALID',
    },
    isCoreParameter: { type: Boolean, default: false },
    sourceText: { type: String, default: '' },
    sourceSection: { type: String, default: '' },
    rankingScore: { type: Number, default: 0 },
    validationReason: { type: String, default: '' },
    rankingReason: { type: String, default: '' },
    canonicalKey: { type: String, default: '' },
    parameterType: { type: String, enum: ['core', 'dynamic'], default: 'core' },
    duplicateHistory: { type: [duplicateSchema], default: [] },
    tenderType: { type: String, default: '' },
    source: { type: String, default: '' },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'REVIEW', 'REJECT'],
      default: 'VERIFIED',
    },
    verificationConfidence: { type: Number, default: 0 },
    verificationReason: { type: String, default: '' },
    verificationScores: { type: Schema.Types.Mixed, default: null },
    verificationAiEvaluated: { type: Boolean, default: false },
    datasetVersion: { type: Number, default: 1 },
    schemaVersion: { type: Number, default: 3 },
  },
  {
    timestamps: true,
    collection: 'enterprise_master_dataset_parameters',
  }
);

schema.index({ documentId: 1, normalizedParameter: 1 });
schema.index({ documentId: 1, datasetVersion: 1 });

export const EnterpriseMasterDatasetParameter = mongoose.model<IEnterpriseMasterDatasetParameter>(
  'EnterpriseMasterDatasetParameter',
  schema
);
