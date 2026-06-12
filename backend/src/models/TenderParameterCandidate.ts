import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenderParameterCandidate extends Document {
  documentId: Types.ObjectId;
  parameter: string;
  originalLabel?: string;
  normalizedParameter?: string;
  canonicalKey?: string;
  category?: string;
  aliasMatchScore?: number;
  aliasMatchMethod?: string;
  isCoreParameter?: boolean;
  value: string;
  pageNumber: number;
  pagePriority?: number;
  sourceSection?: string;
  priorityTier?: number;
  sectionName?: string;
  sectionConfidence?: number;
  confidence: number;
  sourceText: string;
  aiModel: string;
  rankScore?: number;
  rankReason?: string;
  rankBreakdown?: Record<string, unknown>;
  rankWinner?: boolean | null;
  validationPassed?: boolean | null;
  validationStatus?: string;
  validationReason?: string;
  validationRule?: string;
  validationConfidence?: number;
  chunkStartPage?: number;
  chunkEndPage?: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITenderParameterCandidate>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    parameter: { type: String, required: true },
    originalLabel: { type: String, default: '' },
    normalizedParameter: { type: String, default: '' },
    canonicalKey: { type: String, default: '' },
    category: { type: String, default: '' },
    aliasMatchScore: { type: Number, default: 0 },
    aliasMatchMethod: { type: String, default: '' },
    isCoreParameter: { type: Boolean, default: false },
    value: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    pagePriority: { type: Number, default: 0 },
    sourceSection: { type: String, default: '' },
    priorityTier: { type: Number, default: 0 },
    sectionName: { type: String, default: '' },
    sectionConfidence: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    sourceText: { type: String, default: '' },
    aiModel: { type: String, default: 'gemini' },
    rankScore: { type: Number, default: 0 },
    rankReason: { type: String, default: '' },
    rankBreakdown: { type: Schema.Types.Mixed, default: null },
    rankWinner: { type: Boolean, default: null },
    validationPassed: { type: Boolean, default: null },
    validationStatus: { type: String, default: '' },
    validationReason: { type: String, default: '' },
    validationRule: { type: String, default: '' },
    validationConfidence: { type: Number, default: 0 },
    chunkStartPage: { type: Number },
    chunkEndPage: { type: Number },
  },
  {
    timestamps: true,
    collection: 'tender_parameter_candidates',
  }
);

schema.index({ documentId: 1, pageNumber: 1, parameter: 1 });

export const TenderParameterCandidate = mongoose.model<ITenderParameterCandidate>(
  'TenderParameterCandidate',
  schema
);
