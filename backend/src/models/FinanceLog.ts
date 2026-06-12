import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IFinanceLog extends Document {
  tenderId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: UserRole;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt?: Date;
}

const financeLogSchema = new Schema<IFinanceLog>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: Object.values(UserRole), required: true },
    action: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_logs' }
);

financeLogSchema.index({ tenderId: 1, createdAt: -1 });

export const FinanceLog = mongoose.model<IFinanceLog>('FinanceLog', financeLogSchema);
