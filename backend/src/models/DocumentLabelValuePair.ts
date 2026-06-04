import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocumentLabelValuePair extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  label: string;
  value: string;
  pageNumber: number;
  sourceText: string;
  confidence: number;
}

const schema = new Schema<IDocumentLabelValuePair>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    label: { type: String, required: true, index: true },
    value: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    sourceText: { type: String, default: '' },
    confidence: { type: Number, default: 75 },
  },
  { timestamps: true }
);

schema.index({ documentId: 1, label: 1, pageNumber: 1, value: 1 });

export const DocumentLabelValuePair = mongoose.model<IDocumentLabelValuePair>(
  'DocumentLabelValuePair',
  schema
);
