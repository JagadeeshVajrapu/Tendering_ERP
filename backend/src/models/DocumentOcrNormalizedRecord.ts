import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocumentOcrNormalizedRecord extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  label: string;
  value: string;
  pageNumber: number;
  sourceText: string;
}

const schema = new Schema<IDocumentOcrNormalizedRecord>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    label: { type: String, required: true },
    value: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    sourceText: { type: String, default: '' },
  },
  { timestamps: true }
);

schema.index({ documentId: 1, pageNumber: 1, label: 1 });

export const DocumentOcrNormalizedRecord = mongoose.model<IDocumentOcrNormalizedRecord>(
  'DocumentOcrNormalizedRecord',
  schema
);
