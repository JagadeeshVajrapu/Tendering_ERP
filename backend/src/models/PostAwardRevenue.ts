import mongoose, { Document, Schema, Types } from 'mongoose';
import { PostAwardRevenueStatus } from '../types/postAward';

export interface IPostAwardRevenue extends Document {
  contractId: Types.ObjectId;
  tenderId: Types.ObjectId;
  description: string;
  amount: number;
  dueDate?: Date;
  receivedDate?: Date;
  receivedAmount: number;
  status: PostAwardRevenueStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const postAwardRevenueSchema = new Schema<IPostAwardRevenue>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, index: true },
    receivedDate: { type: Date },
    receivedAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'partial', 'received', 'overdue'],
      default: 'pending',
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'post_award_revenue' }
);

export const PostAwardRevenue = mongoose.model<IPostAwardRevenue>(
  'PostAwardRevenue',
  postAwardRevenueSchema
);
