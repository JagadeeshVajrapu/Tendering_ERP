import mongoose, { Document, Schema, Types } from 'mongoose';
import { PostAwardBillingStatus } from '../types/postAward';

export interface IPostAwardBilling extends Document {
  contractId: Types.ObjectId;
  tenderId: Types.ObjectId;
  invoiceNumber?: string;
  description: string;
  amount: number;
  billingDate?: Date;
  status: PostAwardBillingStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const postAwardBillingSchema = new Schema<IPostAwardBilling>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    invoiceNumber: { type: String, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    billingDate: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'invoiced', 'paid'],
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
  { timestamps: true, collection: 'post_award_billing' }
);

export const PostAwardBilling = mongoose.model<IPostAwardBilling>(
  'PostAwardBilling',
  postAwardBillingSchema
);
