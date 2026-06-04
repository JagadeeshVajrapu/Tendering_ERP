import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocumentOpenAiVerification extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  fieldName: string;
  extractedValue: string;
  verifiedValue: string;
  confidence: number;
  sourcePage?: number;
  sourceText?: string;
  correctness?: 'correct' | 'incorrect' | 'uncertain';
  filledMissing?: boolean;
  processingTimeMs?: number;
  aiModel: string;
}

const documentOpenAiVerificationSchema = new Schema<IDocumentOpenAiVerification>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    fieldName: { type: String, required: true, index: true },
    extractedValue: { type: String, default: '' },
    verifiedValue: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    sourcePage: { type: Number },
    sourceText: { type: String, default: '' },
    correctness: { type: String, enum: ['correct', 'incorrect', 'uncertain'] },
    filledMissing: { type: Boolean, default: false },
    processingTimeMs: { type: Number },
    aiModel: { type: String, default: 'gpt-4o' },
  },
  { timestamps: true }
);

documentOpenAiVerificationSchema.index({ documentId: 1, fieldName: 1 }, { unique: true });

export const DocumentOpenAiVerification = mongoose.model<IDocumentOpenAiVerification>(
  'DocumentOpenAiVerification',
  documentOpenAiVerificationSchema
);
