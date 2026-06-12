import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IFinanceApproval extends Document {
  requestId: Types.ObjectId;
  tenderId: Types.ObjectId;
  approverUserId?: Types.ObjectId;
  approverRole: UserRole;
  step: number;
  decision: 'pending' | 'approved' | 'rejected';
  comments?: string;
  decidedAt?: Date;
  createdAt?: Date;
}

const financeApprovalSchema = new Schema<IFinanceApproval>(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'FinanceWorkflowRequest', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    approverUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    approverRole: { type: String, enum: Object.values(UserRole), required: true },
    step: { type: Number, required: true },
    decision: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    comments: { type: String },
    decidedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_approvals' }
);

financeApprovalSchema.index({ requestId: 1, step: 1 }, { unique: true });

export const FinanceApproval = mongoose.model<IFinanceApproval>('FinanceApproval', financeApprovalSchema);
