import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceTaskStatus, FinanceTaskType } from '../types/financeWorkflow';

export interface IFinanceTask extends Document {
  tenderId: Types.ObjectId;
  taskType: FinanceTaskType;
  title: string;
  description?: string;
  status: FinanceTaskStatus;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  relatedRequestId?: Types.ObjectId;
  relatedRecordId?: Types.ObjectId;
  dueDate?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const financeTaskSchema = new Schema<IFinanceTask>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    taskType: {
      type: String,
      enum: ['follow_up_refund', 'renew_bg', 'renew_pbg', 'verify_dd', 'general'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: 'FinanceWorkflowRequest' },
    relatedRecordId: { type: Schema.Types.ObjectId, ref: 'FinanceRecord' },
    dueDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: 'finance_tasks' }
);

financeTaskSchema.index({ assignedTo: 1, status: 1 });

export const FinanceTask = mongoose.model<IFinanceTask>('FinanceTask', financeTaskSchema);
