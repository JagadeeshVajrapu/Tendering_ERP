import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocumentFieldValidation extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  fieldName: string;
  value: string;
  valid: boolean;
  reason: string;
  rawValue?: string;
  validationType?: string;
}

const documentFieldValidationSchema = new Schema<IDocumentFieldValidation>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    fieldName: { type: String, required: true, index: true },
    value: { type: String, default: '' },
    valid: { type: Boolean, required: true },
    reason: { type: String, default: '' },
    rawValue: { type: String, default: '' },
    validationType: { type: String },
  },
  { timestamps: true }
);

documentFieldValidationSchema.index({ documentId: 1, fieldName: 1 }, { unique: true });

export const DocumentFieldValidation = mongoose.model<IDocumentFieldValidation>(
  'DocumentFieldValidation',
  documentFieldValidationSchema
);
