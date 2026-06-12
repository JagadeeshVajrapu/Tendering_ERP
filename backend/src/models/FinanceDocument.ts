import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceDocumentType } from '../types/financeTracking';

export interface IFinanceDocument extends Document {
  tenderId: Types.ObjectId;
  financeRecordId?: Types.ObjectId;
  documentType: FinanceDocumentType;
  fileName: string;
  originalName: string;
  localPath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: Types.ObjectId;
  createdAt?: Date;
}

const financeDocumentSchema = new Schema<IFinanceDocument>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    financeRecordId: { type: Schema.Types.ObjectId, ref: 'FinanceRecord', index: true },
    documentType: {
      type: String,
      enum: [
        'EMD_RECEIPT',
        'BG_COPY',
        'DD_COPY',
        'TENDER_FEE_RECEIPT',
        'SECURITY_DEPOSIT_RECEIPT',
        'PBG_COPY',
      ],
      required: true,
    },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    localPath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_documents' }
);

financeDocumentSchema.index({ tenderId: 1, createdAt: -1 });

export const FinanceDocument = mongoose.model<IFinanceDocument>('FinanceDocument', financeDocumentSchema);
