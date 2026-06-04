import mongoose, { Document, Schema, Types } from 'mongoose';
import { TenderStatus } from '../types';

export interface ITender extends Document {
  title: string;
  tenderNumber?: string;
  authority?: string;
  estimatedValue?: number;
  status: TenderStatus;
  createdBy: Types.ObjectId;
  assignedExecutive?: Types.ObjectId;
  currentStage: string;
  metadata: Record<string, unknown>;
}

const tenderSchema = new Schema<ITender>(
  {
    title: { type: String, required: true, trim: true },
    tenderNumber: { type: String, trim: true },
    authority: { type: String, trim: true },
    estimatedValue: { type: Number },
    status: {
      type: String,
      enum: Object.values(TenderStatus),
      default: TenderStatus.DRAFT,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedExecutive: { type: Schema.Types.ObjectId, ref: 'User' },
    currentStage: { type: String, default: 'Draft' },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

tenderSchema.index({ status: 1, createdBy: 1 });
tenderSchema.index({ tenderNumber: 1 });

export const Tender = mongoose.model<ITender>('Tender', tenderSchema);
