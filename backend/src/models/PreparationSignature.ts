import mongoose, { Document, Schema, Types } from 'mongoose';

export type SignatureType = 'electronic' | 'dsc';
export type SignatureVerificationStatus = 'verified' | 'unverified' | 'failed' | 'pending';

export interface ICertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  certificateClass: 'class3' | 'unknown';
  thumbprint?: string;
}

export interface IPreparationSignature extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  workflowId?: Types.ObjectId;
  signerUserId: Types.ObjectId;
  signerName: string;
  signerRole: string;
  signatureType: SignatureType;
  signatureImagePath?: string;
  signedDocumentId?: Types.ObjectId;
  certificateInfo?: ICertificateInfo;
  dscTokenId?: string;
  verificationStatus: SignatureVerificationStatus;
  verificationMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  signedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const certificateInfoSchema = new Schema<ICertificateInfo>(
  {
    subject: { type: String, required: true },
    issuer: { type: String, required: true },
    serialNumber: { type: String, required: true },
    validFrom: { type: String, required: true },
    validTo: { type: String, required: true },
    certificateClass: { type: String, enum: ['class3', 'unknown'], default: 'unknown' },
    thumbprint: { type: String },
  },
  { _id: false }
);

const preparationSignatureSchema = new Schema<IPreparationSignature>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument', required: true, index: true },
    workflowId: { type: Schema.Types.ObjectId, ref: 'PreparationSigningWorkflow', index: true },
    signerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signerName: { type: String, required: true },
    signerRole: { type: String, required: true },
    signatureType: { type: String, enum: ['electronic', 'dsc'], required: true },
    signatureImagePath: { type: String },
    signedDocumentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument' },
    certificateInfo: { type: certificateInfoSchema },
    dscTokenId: { type: String },
    verificationStatus: {
      type: String,
      enum: ['verified', 'unverified', 'failed', 'pending'],
      default: 'pending',
    },
    verificationMessage: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    signedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

preparationSignatureSchema.index({ tenderId: 1, documentId: 1, signedAt: -1 });
preparationSignatureSchema.index({ workflowId: 1, signedAt: 1 });

export const PreparationSignature = mongoose.model<IPreparationSignature>(
  'PreparationSignature',
  preparationSignatureSchema
);
