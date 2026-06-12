import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  DynamicChecklistAlert,
  DynamicChecklistCategory,
  DynamicChecklistSummary,
} from '../types/dynamicChecklist';

export interface ITenderDynamicChecklist extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  serviceCategory: string;
  schemaVersion: number;
  dataSource: string;
  categories: DynamicChecklistCategory[];
  summary: DynamicChecklistSummary;
  alerts: DynamicChecklistAlert[];
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITenderDynamicChecklist>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    serviceCategory: { type: String, default: '' },
    schemaVersion: { type: Number, default: 2 },
    dataSource: { type: String, default: 'enterprise_master_dataset' },
    categories: { type: Schema.Types.Mixed, default: [] },
    summary: { type: Schema.Types.Mixed, default: {} },
    alerts: { type: Schema.Types.Mixed, default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'tender_dynamic_checklists',
  }
);

export const TenderDynamicChecklist = mongoose.model<ITenderDynamicChecklist>(
  'TenderDynamicChecklist',
  schema
);
