import mongoose, { Document, Schema, Types } from 'mongoose';

export type ExtractionStatus =
  | 'uploaded'
  | 'processing'
  | 'text_extracted'
  | 'rule_analysis_complete'
  | 'ai_verification_complete'
  | 'failed';

export type MatchType = 'exact' | 'regex' | 'alias' | 'fuzzy';

export interface IExtractedField {
  fieldName: string;
  value: string;
  normalizedValue?: string;
  confidence: number; // 0-100
  matchType: MatchType;
  ruleId?: Types.ObjectId;
  evidence?: string;
}

export interface IAiVerificationResult {
  provider: 'openai' | 'gemini';
  verifiedAt: Date;
  verifiedFields: Array<{ fieldName: string; value: string; ok: boolean; reason?: string }>;
  missingFields: string[];
  corrections: Array<{ fieldName: string; from?: string; to: string; reason?: string }>;
}

export interface ITenderExtraction extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  status: ExtractionStatus;
  progress: number;
  errorMessage?: string;

  detectedFileType?: 'digital_pdf' | 'scanned_pdf' | 'docx' | 'image' | 'unknown';
  extractedText?: string;
  cleanedText?: string;

  extractedFields: IExtractedField[];
  aiVerification?: IAiVerificationResult;

  createdBy: Types.ObjectId;
}

const extractedFieldSchema = new Schema<IExtractedField>(
  {
    fieldName: { type: String, required: true, index: true },
    value: { type: String, required: true },
    normalizedValue: { type: String },
    confidence: { type: Number, required: true },
    matchType: { type: String, enum: ['exact', 'regex', 'alias', 'fuzzy'], required: true },
    ruleId: { type: Schema.Types.ObjectId, ref: 'ExtractionRule' },
    evidence: { type: String },
  },
  { _id: false }
);

const aiVerificationSchema = new Schema<IAiVerificationResult>(
  {
    provider: { type: String, enum: ['openai', 'gemini'], required: true },
    verifiedAt: { type: Date, required: true },
    verifiedFields: {
      type: [
        new Schema(
          {
            fieldName: { type: String, required: true },
            value: { type: String, required: true },
            ok: { type: Boolean, required: true },
            reason: { type: String },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    missingFields: { type: [String], default: [] },
    corrections: {
      type: [
        new Schema(
          {
            fieldName: { type: String, required: true },
            from: { type: String },
            to: { type: String, required: true },
            reason: { type: String },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const tenderExtractionSchema = new Schema<ITenderExtraction>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    status: { type: String, required: true, index: true },
    progress: { type: Number, default: 0 },
    errorMessage: { type: String },
    detectedFileType: {
      type: String,
      enum: ['digital_pdf', 'scanned_pdf', 'docx', 'image', 'unknown'],
      default: 'unknown',
    },
    extractedText: { type: String },
    cleanedText: { type: String },
    extractedFields: { type: [extractedFieldSchema], default: [] },
    aiVerification: { type: aiVerificationSchema },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

tenderExtractionSchema.index({ tenderId: 1, createdAt: -1 });
tenderExtractionSchema.index({ documentId: 1, createdAt: -1 });

export const TenderExtraction = mongoose.model<ITenderExtraction>('TenderExtraction', tenderExtractionSchema);

