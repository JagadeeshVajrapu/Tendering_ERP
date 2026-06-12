import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export type WorkflowStatus = 'draft' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
export type WorkflowStepStatus = 'pending' | 'active' | 'signed' | 'rejected' | 'skipped';
export type SignerRole = 'executive' | 'manager' | 'md';

export interface IWorkflowStep {
  order: number;
  role: SignerRole;
  label: string;
  assignedUserId?: Types.ObjectId;
  assignedUserName?: string;
  status: WorkflowStepStatus;
  signedAt?: Date;
  signatureId?: Types.ObjectId;
  rejectionReason?: string;
}

export interface IPreparationSigningWorkflow extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  documentName: string;
  title: string;
  status: WorkflowStatus;
  steps: IWorkflowStep[];
  currentStepIndex: number;
  signedDocumentId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    order: { type: Number, required: true },
    role: { type: String, enum: ['executive', 'manager', 'md'], required: true },
    label: { type: String, required: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedUserName: { type: String },
    status: {
      type: String,
      enum: ['pending', 'active', 'signed', 'rejected', 'skipped'],
      default: 'pending',
    },
    signedAt: { type: Date },
    signatureId: { type: Schema.Types.ObjectId, ref: 'PreparationSignature' },
    rejectionReason: { type: String },
  },
  { _id: false }
);

const preparationSigningWorkflowSchema = new Schema<IPreparationSigningWorkflow>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument', required: true, index: true },
    documentName: { type: String, required: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'completed', 'rejected', 'cancelled'],
      default: 'draft',
    },
    steps: { type: [workflowStepSchema], default: [] },
    currentStepIndex: { type: Number, default: 0 },
    signedDocumentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

preparationSigningWorkflowSchema.index({ tenderId: 1, status: 1 });
preparationSigningWorkflowSchema.index({ tenderId: 1, documentId: 1 });

export const SIGNER_ROLE_MAP: Record<SignerRole, UserRole> = {
  executive: UserRole.EXECUTIVE,
  manager: UserRole.MANAGER,
  md: UserRole.MD,
};

export const PreparationSigningWorkflow = mongoose.model<IPreparationSigningWorkflow>(
  'PreparationSigningWorkflow',
  preparationSigningWorkflowSchema
);
