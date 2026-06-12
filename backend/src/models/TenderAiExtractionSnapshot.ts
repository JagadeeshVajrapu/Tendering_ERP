import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenderAiExtractionSnapshot extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  parameter: string;
  originalLabel?: string;
  value: string;
  pageNumber: number;
  confidence: number;
  sourceText: string;
  sourceSection: string;
  aiModel: string;
  extractedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITenderAiExtractionSnapshot>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    parameter: { type: String, required: true },
    originalLabel: { type: String, default: '' },
    value: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    confidence: { type: Number, default: 0 },
    sourceText: { type: String, default: '' },
    sourceSection: { type: String, default: '' },
    aiModel: { type: String, default: '' },
    extractedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'tender_ai_extraction_snapshots',
  }
);

schema.index({ documentId: 1, pageNumber: 1, parameter: 1 });

export const TenderAiExtractionSnapshot = mongoose.model<ITenderAiExtractionSnapshot>(
  'TenderAiExtractionSnapshot',
  schema
);
