import mongoose, { Document, Schema, Types } from 'mongoose';

export type NitExtractionMethod = 'exact' | 'alias' | 'regex' | 'fuzzy';

export interface IDocumentNitExtractedField extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  fieldName: string;
  extractedValue: string;
  sourcePage: number;
  sourceText: string;
  extractionMethod: NitExtractionMethod;
}

const documentNitExtractedFieldSchema = new Schema<IDocumentNitExtractedField>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    fieldName: { type: String, required: true, index: true },
    extractedValue: { type: String, required: true },
    sourcePage: { type: Number, required: true },
    sourceText: { type: String, default: '' },
    extractionMethod: {
      type: String,
      enum: ['exact', 'alias', 'regex', 'fuzzy'],
      required: true,
    },
  },
  { timestamps: true }
);

documentNitExtractedFieldSchema.index({ documentId: 1, fieldName: 1 }, { unique: true });

export const DocumentNitExtractedField = mongoose.model<IDocumentNitExtractedField>(
  'DocumentNitExtractedField',
  documentNitExtractedFieldSchema
);
