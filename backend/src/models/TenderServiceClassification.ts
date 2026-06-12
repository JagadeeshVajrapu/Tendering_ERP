import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenderServiceClassification extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  serviceCategory: string;
  confidence: number;
  matchedKeywords: string[];
  categoryScores: Record<string, number>;
  pagesScanned: number;
  classifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITenderServiceClassification>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    serviceCategory: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    matchedKeywords: { type: [String], default: [] },
    categoryScores: { type: Schema.Types.Mixed, default: {} },
    pagesScanned: { type: Number, default: 0 },
    classifiedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'tender_service_classifications',
  }
);

export const TenderServiceClassification = mongoose.model<ITenderServiceClassification>(
  'TenderServiceClassification',
  schema
);
