import mongoose, { Document, Schema, Types } from 'mongoose';
import { QueueJobStatus, QueueJobType } from '../queues/types';

export interface IQueueJob extends Document {
  bullJobId?: string;
  type: QueueJobType;
  status: QueueJobStatus;
  progress: number;
  tenderId: Types.ObjectId;
  documentId?: Types.ObjectId;
  intelligenceJobId?: Types.ObjectId;
  userId: Types.ObjectId;
  errorMessage?: string;
  result?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const queueJobSchema = new Schema<IQueueJob>(
  {
    bullJobId: { type: String, index: true },
    type: {
      type: String,
      enum: ['tender-analysis', 'report-generation', 'tender-extraction'],
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed', 'failed'],
      default: 'waiting',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument' },
    intelligenceJobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    errorMessage: { type: String },
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const QueueJob = mongoose.model<IQueueJob>('QueueJob', queueJobSchema);
