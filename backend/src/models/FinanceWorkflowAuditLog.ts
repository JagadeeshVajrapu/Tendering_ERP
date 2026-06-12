import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IFinanceWorkflowAuditLog extends Document {
  tenderId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: UserRole;
  action: string;
  message: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

const financeWorkflowAuditLogSchema = new Schema<IFinanceWorkflowAuditLog>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: Object.values(UserRole), required: true },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    ipAddress: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_audit_logs' }
);

financeWorkflowAuditLogSchema.index({ tenderId: 1, createdAt: -1 });

export const FinanceWorkflowAuditLog = mongoose.model<IFinanceWorkflowAuditLog>(
  'FinanceWorkflowAuditLog',
  financeWorkflowAuditLogSchema
);
