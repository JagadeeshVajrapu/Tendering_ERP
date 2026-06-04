import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOcrQualityMetrics {
  pages: number;
  totalCharacters: number;
  averageCharactersPerPage: number;
  qualityScore: number;
}

export interface ITenderDocument extends Document {
  tenderId: Types.ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  s3Url: string;
  localPath?: string;
  documentType: 'NIT' | 'COMPLIANCE' | 'PAYMENT_PROOF' | 'OTHER';
  uploadedBy: Types.ObjectId;
  extractedText?: string;
  pageCount?: number;
  intelligenceJobId?: Types.ObjectId;
  ocrDetectedType?: 'digital_pdf' | 'scanned_pdf' | 'docx' | 'image';
  ocrExtractionMethod?: 'pdf-parse' | 'textract' | 'mammoth';
  ocrQualityMetrics?: IOcrQualityMetrics;
  ocrProcessingTimeMs?: number;
}

const tenderDocumentSchema = new Schema<ITenderDocument>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    s3Key: { type: String, required: true },
    s3Url: { type: String, required: true },
    localPath: { type: String },
    documentType: {
      type: String,
      enum: ['NIT', 'COMPLIANCE', 'PAYMENT_PROOF', 'OTHER'],
      default: 'NIT',
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    extractedText: { type: String },
    pageCount: { type: Number, default: 0 },
    intelligenceJobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob' },
    ocrDetectedType: {
      type: String,
      enum: ['digital_pdf', 'scanned_pdf', 'docx', 'image'],
    },
    ocrExtractionMethod: {
      type: String,
      enum: ['pdf-parse', 'textract', 'mammoth'],
    },
    ocrQualityMetrics: {
      pages: { type: Number },
      totalCharacters: { type: Number },
      averageCharactersPerPage: { type: Number },
      qualityScore: { type: Number },
    },
    ocrProcessingTimeMs: { type: Number },
  },
  { timestamps: true }
);

tenderDocumentSchema.index({ tenderId: 1 });

export const TenderDocument = mongoose.model<ITenderDocument>('TenderDocument', tenderDocumentSchema);
