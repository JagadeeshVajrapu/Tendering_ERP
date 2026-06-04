import mongoose, { Document, Schema, Types } from 'mongoose';

export type LocatorExtractionMethod = 'regex' | 'keyword' | 'alias';

export interface IDocumentLocatorField extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  fieldName: string;
  value: string;
  sourcePage: number;
  sourceText: string;
  extractionMethod: LocatorExtractionMethod;
  confidence?: number;
}

const documentLocatorFieldSchema = new Schema<IDocumentLocatorField>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    fieldName: { type: String, required: true, index: true },
    value: { type: String, required: true },
    sourcePage: { type: Number, required: true },
    sourceText: { type: String, default: '' },
    extractionMethod: {
      type: String,
      enum: ['regex', 'keyword', 'alias'],
      required: true,
    },
    confidence: { type: Number },
  },
  { timestamps: true }
);

documentLocatorFieldSchema.index({ documentId: 1, fieldName: 1 }, { unique: true });

export const DocumentLocatorField = mongoose.model<IDocumentLocatorField>(
  'DocumentLocatorField',
  documentLocatorFieldSchema
);
