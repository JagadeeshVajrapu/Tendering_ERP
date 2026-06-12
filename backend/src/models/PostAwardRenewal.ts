import mongoose, { Document, Schema, Types } from 'mongoose';
import { PostAwardRenewalStatus } from '../types/postAward';

export interface IPostAwardRenewal extends Document {
  contractId: Types.ObjectId;
  tenderId: Types.ObjectId;
  renewalType: 'contract' | 'amc' | 'agreement';
  status: PostAwardRenewalStatus;
  originalEndDate?: Date;
  renewalDate?: Date;
  newEndDate?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const postAwardRenewalSchema = new Schema<IPostAwardRenewal>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    renewalType: { type: String, enum: ['contract', 'amc', 'agreement'], required: true },
    status: {
      type: String,
      enum: ['active', 'expiring_soon', 'renewal_pending', 'renewed', 'expired'],
      default: 'active',
    },
    originalEndDate: { type: Date },
    renewalDate: { type: Date },
    newEndDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true, collection: 'post_award_renewals' }
);

export const PostAwardRenewal = mongoose.model<IPostAwardRenewal>(
  'PostAwardRenewal',
  postAwardRenewalSchema
);
