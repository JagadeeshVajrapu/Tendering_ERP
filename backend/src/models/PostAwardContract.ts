import mongoose, { Document, Schema, Types } from 'mongoose';
import { PostAwardContractStatus, PostAwardRenewalStatus } from '../types/postAward';

export interface IPostAwardContract extends Document {
  tenderId: Types.ObjectId;
  clientName: string;
  tenderNumber?: string;
  tenderTitle: string;
  workOrderNumber?: string;
  agreementNumber?: string;
  purchaseOrderNumber?: string;
  contractValue: number;
  contractStartDate?: Date;
  contractEndDate?: Date;
  amcStartDate?: Date;
  amcEndDate?: Date;
  agreementExpiryDate?: Date;
  status: PostAwardContractStatus;
  renewalStatus: PostAwardRenewalStatus;
  totalRevenue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  activatedAt: Date;
  awardedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const postAwardContractSchema = new Schema<IPostAwardContract>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, unique: true, index: true },
    clientName: { type: String, required: true, index: true },
    tenderNumber: { type: String, index: true },
    tenderTitle: { type: String, required: true, index: true },
    workOrderNumber: { type: String, index: true },
    agreementNumber: { type: String, index: true },
    purchaseOrderNumber: { type: String, index: true },
    contractValue: { type: Number, default: 0 },
    contractStartDate: { type: Date },
    contractEndDate: { type: Date, index: true },
    amcStartDate: { type: Date },
    amcEndDate: { type: Date, index: true },
    agreementExpiryDate: { type: Date, index: true },
    status: {
      type: String,
      enum: ['active', 'expiring_soon', 'expired', 'completed'],
      default: 'active',
      index: true,
    },
    renewalStatus: {
      type: String,
      enum: ['active', 'expiring_soon', 'renewal_pending', 'renewed', 'expired'],
      default: 'active',
    },
    totalRevenue: { type: Number, default: 0 },
    revenueReceived: { type: Number, default: 0 },
    revenuePending: { type: Number, default: 0 },
    pendingBilling: { type: Number, default: 0 },
    activatedAt: { type: Date, required: true },
    awardedAt: { type: Date },
  },
  { timestamps: true, collection: 'post_award_contracts' }
);

postAwardContractSchema.index({ clientName: 'text', tenderTitle: 'text', tenderNumber: 'text' });

export const PostAwardContract = mongoose.model<IPostAwardContract>(
  'PostAwardContract',
  postAwardContractSchema
);
