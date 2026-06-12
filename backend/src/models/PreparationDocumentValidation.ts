import mongoose, { Document, Schema, Types } from 'mongoose';

export type ValidationStatus = 'valid' | 'warning' | 'error';

export type ValidationCheckCategory =
  | 'file_size'
  | 'portal_format'
  | 'blank_page'
  | 'signature'
  | 'certificate_expiry';

export type CertificateType = 'iso' | 'bank_solvency' | 'license' | 'registration';

export interface IValidationCheck {
  id: string;
  category: ValidationCheckCategory;
  status: ValidationStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface ICertificateFinding {
  type: CertificateType;
  name: string;
  status: ValidationStatus | 'unknown';
  expiryDate?: string;
  daysUntilExpiry?: number;
  evidence?: string;
}

export interface IPreparationDocumentValidation extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  documentName: string;
  status: ValidationStatus;
  score: number;
  checks: IValidationCheck[];
  certificateFindings: ICertificateFinding[];
  blankPages: number[];
  hasSignature: boolean;
  validatedBy?: Types.ObjectId;
  validatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const validationCheckSchema = new Schema<IValidationCheck>(
  {
    id: { type: String, required: true },
    category: {
      type: String,
      enum: ['file_size', 'portal_format', 'blank_page', 'signature', 'certificate_expiry'],
      required: true,
    },
    status: { type: String, enum: ['valid', 'warning', 'error'], required: true },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const certificateFindingSchema = new Schema<ICertificateFinding>(
  {
    type: { type: String, enum: ['iso', 'bank_solvency', 'license', 'registration'], required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['valid', 'warning', 'error', 'unknown'], required: true },
    expiryDate: { type: String },
    daysUntilExpiry: { type: Number },
    evidence: { type: String },
  },
  { _id: false }
);

const preparationDocumentValidationSchema = new Schema<IPreparationDocumentValidation>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'PreparationDocument',
      required: true,
      unique: true,
    },
    documentName: { type: String, required: true },
    status: { type: String, enum: ['valid', 'warning', 'error'], required: true },
    score: { type: Number, default: 0 },
    checks: { type: [validationCheckSchema], default: [] },
    certificateFindings: { type: [certificateFindingSchema], default: [] },
    blankPages: { type: [Number], default: [] },
    hasSignature: { type: Boolean, default: false },
    validatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    validatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

preparationDocumentValidationSchema.index({ tenderId: 1, status: 1 });

export const PreparationDocumentValidation = mongoose.model<IPreparationDocumentValidation>(
  'PreparationDocumentValidation',
  preparationDocumentValidationSchema
);
