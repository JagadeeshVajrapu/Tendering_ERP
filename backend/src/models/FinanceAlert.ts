import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceAlertLevel } from '../types/financeTracking';

export interface IFinanceAlert extends Document {
  tenderId: Types.ObjectId;
  financeRecordId: Types.ObjectId;
  recordType: 'BG' | 'PBG';
  instrumentNumber: string;
  alertLevel: FinanceAlertLevel;
  message: string;
  daysUntilExpiry: number;
  expiryDate: Date;
  createdAt?: Date;
}

const financeAlertSchema = new Schema<IFinanceAlert>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    financeRecordId: { type: Schema.Types.ObjectId, ref: 'FinanceRecord', required: true, index: true },
    recordType: { type: String, enum: ['BG', 'PBG'], required: true },
    instrumentNumber: { type: String, required: true },
    alertLevel: {
      type: String,
      enum: ['30_days', '15_days', '7_days', 'expired'],
      required: true,
    },
    message: { type: String, required: true },
    daysUntilExpiry: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_alerts' }
);

financeAlertSchema.index({ tenderId: 1, financeRecordId: 1, alertLevel: 1 }, { unique: true });

export const FinanceAlert = mongoose.model<IFinanceAlert>('FinanceAlert', financeAlertSchema);
