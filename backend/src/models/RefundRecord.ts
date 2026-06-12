import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceRecordType, RefundStatus } from '../types/financeTracking';

export interface IRefundHistoryEntry {
  status: RefundStatus;
  date: Date;
  updatedBy?: Types.ObjectId;
  updatedByName?: string;
  note?: string;
}

export interface IRefundRecord extends Document {
  tenderId: Types.ObjectId;
  financeRecordId: Types.ObjectId;
  instrumentType: FinanceRecordType;
  instrumentLabel: string;
  amount: number;
  status: RefundStatus;
  requestDate?: Date;
  approvalDate?: Date;
  receivedDate?: Date;
  history: IRefundHistoryEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

const refundHistorySchema = new Schema<IRefundHistoryEntry>(
  {
    status: {
      type: String,
      enum: ['pending', 'requested', 'approved', 'received'],
      required: true,
    },
    date: { type: Date, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String },
    note: { type: String },
  },
  { _id: false }
);

const refundRecordSchema = new Schema<IRefundRecord>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    financeRecordId: { type: Schema.Types.ObjectId, ref: 'FinanceRecord', required: true, index: true },
    instrumentType: {
      type: String,
      enum: ['EMD', 'SECURITY_DEPOSIT', 'PBG'],
      required: true,
    },
    instrumentLabel: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'requested', 'approved', 'received'],
      default: 'pending',
    },
    requestDate: { type: Date },
    approvalDate: { type: Date },
    receivedDate: { type: Date },
    history: { type: [refundHistorySchema], default: [] },
  },
  { timestamps: true, collection: 'refund_records' }
);

refundRecordSchema.index({ tenderId: 1, status: 1 });

export const RefundRecord = mongoose.model<IRefundRecord>('RefundRecord', refundRecordSchema);
