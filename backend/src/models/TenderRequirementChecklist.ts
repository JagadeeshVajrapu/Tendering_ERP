import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenderRequirementChecklist extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  serviceCategory: string;
  categories: unknown[];
  totalItems: number;
  requiredCount: number;
  mentionedInTenderCount: number;
  discoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITenderRequirementChecklist>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    serviceCategory: { type: String, default: '' },
    categories: { type: Schema.Types.Mixed, default: [] },
    totalItems: { type: Number, default: 0 },
    requiredCount: { type: Number, default: 0 },
    mentionedInTenderCount: { type: Number, default: 0 },
    discoveredAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'tender_requirement_checklists',
  }
);

export const TenderRequirementChecklist = mongoose.model<ITenderRequirementChecklist>(
  'TenderRequirementChecklist',
  schema
);
