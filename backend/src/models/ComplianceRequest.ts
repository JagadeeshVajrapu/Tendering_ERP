import mongoose, { Document, Schema, Types } from 'mongoose';

export enum ComplianceStatus {
  PENDING = 'MANAGER_PENDING',
  APPROVED = 'MANAGER_APPROVED',
  REJECTED = 'REJECTED',
}

export interface IComplianceRequest extends Document {
  tenderId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  documentTypes: string[];
  status: ComplianceStatus;
  approvedBy?: Types.ObjectId;
  documentIds: Types.ObjectId[];
  comments?: string;
  decidedAt?: Date;
}

const complianceRequestSchema = new Schema<IComplianceRequest>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    documentTypes: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(ComplianceStatus),
      default: ComplianceStatus.PENDING,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    documentIds: [{ type: Schema.Types.ObjectId, ref: 'TenderDocument' }],
    comments: { type: String },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

complianceRequestSchema.index({ tenderId: 1, status: 1 });

export const ComplianceRequest = mongoose.model<IComplianceRequest>('ComplianceRequest', complianceRequestSchema);
