import mongoose, { Document, Schema, Types } from 'mongoose';

export type ExtractionMethod = 'native' | 'ocr' | 'docx' | 'pdf-parse' | 'textract' | 'mammoth';

export interface IDocumentPage extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  pageNumber: number;
  extractedText: string;
  characterCount: number;
  extractionMethod: ExtractionMethod;
}

const documentPageSchema = new Schema<IDocumentPage>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    pageNumber: { type: Number, required: true },
    extractedText: { type: String, default: '' },
    extractionMethod: {
      type: String,
      enum: ['native', 'ocr', 'docx', 'pdf-parse', 'textract', 'mammoth'],
      default: 'native',
    },
    characterCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

documentPageSchema.index({ documentId: 1, pageNumber: 1 }, { unique: true });

export const DocumentPage = mongoose.model<IDocumentPage>('DocumentPage', documentPageSchema);
