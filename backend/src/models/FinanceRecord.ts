import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceRecordType, RefundStatus } from '../types/financeTracking';

export interface IFinanceRecord extends Document {
  tenderId: Types.ObjectId;
  recordType: FinanceRecordType;
  amount: number;
  bankName?: string;
  referenceNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  status: string;
  remarks?: string;
  createdBy: Types.ObjectId;
  paymentDate?: Date;
  paymentMode?: string;
  transactionReferenceNumber?: string;
  refundStatus?: RefundStatus;
  instrumentNumber?: string;
  depositDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const financeRecordSchema = new Schema<IFinanceRecord>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    recordType: {
      type: String,
      enum: ['EMD', 'BG', 'DD', 'TENDER_FEE', 'SECURITY_DEPOSIT', 'PBG'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    bankName: { type: String },
    referenceNumber: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    status: { type: String, required: true },
    remarks: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentDate: { type: Date },
    paymentMode: { type: String },
    transactionReferenceNumber: { type: String },
    refundStatus: {
      type: String,
      enum: ['pending', 'requested', 'approved', 'received'],
    },
    instrumentNumber: { type: String },
    depositDate: { type: Date },
  },
  { timestamps: true, collection: 'finance_records' }
);

financeRecordSchema.index({ tenderId: 1, recordType: 1 });
financeRecordSchema.index({ tenderId: 1, createdAt: -1 });

export const FinanceRecord = mongoose.model<IFinanceRecord>('FinanceRecord', financeRecordSchema);
