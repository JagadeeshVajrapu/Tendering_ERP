import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceRequestType, FinanceRequestStatus } from '../types';

export interface IFinanceRequest extends Document {
  tenderId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  requestType: FinanceRequestType;
  amount: number;
  status: FinanceRequestStatus;
  approvedBy?: Types.ObjectId;
  rejectedBy?: Types.ObjectId;
  transactionId?: string;
  utrNumber?: string;
  bankDetails?: string;
  paymentProofUrl?: string;
  paymentProofKey?: string;
  comments?: string;
  decidedAt?: Date;
  paidAt?: Date;
}

const financeRequestSchema = new Schema<IFinanceRequest>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestType: { type: String, enum: Object.values(FinanceRequestType), required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(FinanceRequestStatus),
      default: FinanceRequestStatus.PENDING,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    transactionId: { type: String },
    utrNumber: { type: String },
    bankDetails: { type: String },
    paymentProofUrl: { type: String },
    paymentProofKey: { type: String },
    comments: { type: String },
    decidedAt: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

financeRequestSchema.index({ tenderId: 1, status: 1 });

export const FinanceRequest = mongoose.model<IFinanceRequest>('FinanceRequest', financeRequestSchema);
