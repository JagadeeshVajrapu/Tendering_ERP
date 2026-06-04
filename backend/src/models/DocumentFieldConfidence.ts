import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConfidenceBreakdown {
  extractionMethod: string;
  validated: boolean;
  aiVerified: boolean;
  aiConfidence: number | null;
  aiInferred: boolean;
  baseBand: string;
  scoreBeforeAdjustments: number;
  adjustments: string[];
}

export interface IDocumentFieldConfidence extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  fieldName: string;
  value: string;
  confidence: number;
  confidenceReason: string;
  sourcePage: number;
  sourceText: string;
  lowConfidence: boolean;
  extractionMethod?: string;
  breakdown?: IConfidenceBreakdown;
}

const breakdownSchema = new Schema<IConfidenceBreakdown>(
  {
    extractionMethod: { type: String, default: 'unknown' },
    validated: { type: Boolean, default: false },
    aiVerified: { type: Boolean, default: false },
    aiConfidence: { type: Number, default: null },
    aiInferred: { type: Boolean, default: false },
    baseBand: { type: String, default: '' },
    scoreBeforeAdjustments: { type: Number, default: 0 },
    adjustments: { type: [String], default: [] },
  },
  { _id: false }
);

const documentFieldConfidenceSchema = new Schema<IDocumentFieldConfidence>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    fieldName: { type: String, required: true, index: true },
    value: { type: String, default: '' },
    confidence: { type: Number, required: true, index: true },
    confidenceReason: { type: String, default: '' },
    sourcePage: { type: Number, default: 0 },
    sourceText: { type: String, default: '' },
    lowConfidence: { type: Boolean, default: false, index: true },
    extractionMethod: { type: String },
    breakdown: { type: breakdownSchema },
  },
  { timestamps: true }
);

documentFieldConfidenceSchema.index({ documentId: 1, fieldName: 1 }, { unique: true });

export const DocumentFieldConfidence = mongoose.model<IDocumentFieldConfidence>(
  'DocumentFieldConfidence',
  documentFieldConfidenceSchema
);
