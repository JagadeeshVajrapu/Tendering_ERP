import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceCommentType } from '../types/financeWorkflow';
import { UserRole } from '../types';

export interface IFinanceComment extends Document {
  tenderId: Types.ObjectId;
  requestId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: UserRole;
  commentType: FinanceCommentType;
  content: string;
  createdAt?: Date;
}

const financeCommentSchema = new Schema<IFinanceComment>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    requestId: { type: Schema.Types.ObjectId, ref: 'FinanceWorkflowRequest', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: Object.values(UserRole), required: true },
    commentType: {
      type: String,
      enum: ['internal_note', 'finance_remark', 'approval_comment'],
      required: true,
    },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_comments' }
);

financeCommentSchema.index({ requestId: 1, createdAt: -1 });

export const FinanceComment = mongoose.model<IFinanceComment>('FinanceComment', financeCommentSchema);
