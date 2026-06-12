import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPreparationOcrPage {
  pageNumber: number;
  text: string;
  charCount: number;
  method: 'pdf-parse' | 'tesseract' | 'hybrid';
}

export interface IPreparationDocumentOcr extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'pdf-parse' | 'tesseract' | 'hybrid';
  fullText: string;
  pages: IPreparationOcrPage[];
  pageCount: number;
  qualityScore: number;
  processingTimeMs: number;
  errorMessage?: string;
  processedBy?: Types.ObjectId;
}

const ocrPageSchema = new Schema<IPreparationOcrPage>(
  {
    pageNumber: { type: Number, required: true },
    text: { type: String, default: '' },
    charCount: { type: Number, default: 0 },
    method: { type: String, enum: ['pdf-parse', 'tesseract', 'hybrid'], default: 'pdf-parse' },
  },
  { _id: false }
);

const preparationDocumentOcrSchema = new Schema<IPreparationDocumentOcr>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument', required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    method: { type: String, enum: ['pdf-parse', 'tesseract', 'hybrid'], default: 'pdf-parse' },
    fullText: { type: String, default: '' },
    pages: { type: [ocrPageSchema], default: [] },
    pageCount: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0 },
    processingTimeMs: { type: Number, default: 0 },
    errorMessage: { type: String },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

preparationDocumentOcrSchema.index({ tenderId: 1, documentId: 1 });

export const PreparationDocumentOcr = mongoose.model<IPreparationDocumentOcr>(
  'PreparationDocumentOcr',
  preparationDocumentOcrSchema
);
