import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceWorkflowRequestType, FinanceWorkflowStatus } from '../types/financeWorkflow';
import { UserRole } from '../types';

export interface IFinanceWorkflowRequest extends Document {
  requestNumber: string;
  tenderId: Types.ObjectId;
  requestType: FinanceWorkflowRequestType;
  amount: number;
  requestedBy: Types.ObjectId;
  status: FinanceWorkflowStatus;
  currentApproverRole?: UserRole;
  approvalStep: number;
  approvalDate?: Date;
  rejectionReason?: string;
  remarks?: string;
  financeRecordId?: Types.ObjectId;
  refundRecordId?: Types.ObjectId;
  renewalOriginalRecordId?: Types.ObjectId;
  renewalDate?: Date;
  newExpiryDate?: Date;
  renewalStatus?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const financeWorkflowRequestSchema = new Schema<IFinanceWorkflowRequest>(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    requestType: {
      type: String,
      enum: [
        'EMD_REQUEST',
        'BG_REQUEST',
        'DD_REQUEST',
        'TENDER_FEE_PAYMENT',
        'SECURITY_DEPOSIT_PAYMENT',
        'PBG_REQUEST',
        'REFUND_EMD',
        'REFUND_SECURITY_DEPOSIT',
        'PBG_RELEASE',
        'BG_RENEWAL',
        'PBG_RENEWAL',
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'pending_finance',
        'pending_manager',
        'approved',
        'rejected',
        'completed',
      ],
      default: 'draft',
      index: true,
    },
    currentApproverRole: { type: String, enum: Object.values(UserRole) },
    approvalStep: { type: Number, default: 0 },
    approvalDate: { type: Date },
    rejectionReason: { type: String },
    remarks: { type: String },
    financeRecordId: { type: Schema.Types.ObjectId, ref: 'FinanceRecord' },
    refundRecordId: { type: Schema.Types.ObjectId, ref: 'RefundRecord' },
    renewalOriginalRecordId: { type: Schema.Types.ObjectId, ref: 'FinanceRecord' },
    renewalDate: { type: Date },
    newExpiryDate: { type: Date },
    renewalStatus: { type: String },
  },
  { timestamps: true, collection: 'finance_requests' }
);

financeWorkflowRequestSchema.index({ tenderId: 1, status: 1, createdAt: -1 });

export const FinanceWorkflowRequest = mongoose.model<IFinanceWorkflowRequest>(
  'FinanceWorkflowRequest',
  financeWorkflowRequestSchema
);
