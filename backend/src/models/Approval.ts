import mongoose, { Document, Schema, Types } from 'mongoose';
import { ApprovalType, ApprovalDecision } from '../types';

export interface IApproval extends Document {
  tenderId: Types.ObjectId;
  type: ApprovalType;
  requestedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  decision: ApprovalDecision;
  comments?: string;
  decidedAt?: Date;
  summaryId?: Types.ObjectId;
}

const approvalSchema = new Schema<IApproval>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    type: { type: String, enum: Object.values(ApprovalType), required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decision: {
      type: String,
      enum: Object.values(ApprovalDecision),
      default: ApprovalDecision.PENDING,
    },
    comments: { type: String },
    decidedAt: { type: Date },
    summaryId: { type: Schema.Types.ObjectId, ref: 'TenderSummary' },
  },
  { timestamps: true }
);

approvalSchema.index({ tenderId: 1, type: 1 });
approvalSchema.index({ decision: 1, type: 1 });

export const Approval = mongoose.model<IApproval>('Approval', approvalSchema);
