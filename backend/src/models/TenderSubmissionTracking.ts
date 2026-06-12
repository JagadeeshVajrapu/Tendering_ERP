import mongoose, { Document, Schema, Types } from 'mongoose';
import { SubmissionTrackingStatus } from '../types/submissionTracking';

export interface ITenderSubmissionTracking extends Document {
  tenderId: Types.ObjectId;
  status: SubmissionTrackingStatus;
  completionPercentage: number;
  readinessLabel: string;
  mandatoryComplete: boolean;
  lockedAt?: Date;
  lockedBy?: Types.ObjectId;
  submittedAt?: Date;
  submittedBy?: Types.ObjectId;
  deadlineAt?: Date;
  deadlineLabel?: string;
  lastAlertLevel?: string;
  lastAlertAt?: Date;
  checklistSnapshot?: Record<string, unknown>;
  submissionNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const tenderSubmissionTrackingSchema = new Schema<ITenderSubmissionTracking>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'ready', 'locked', 'submitted'],
      default: 'draft',
    },
    completionPercentage: { type: Number, default: 0 },
    readinessLabel: { type: String, default: 'Not started' },
    mandatoryComplete: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deadlineAt: { type: Date },
    deadlineLabel: { type: String },
    lastAlertLevel: { type: String },
    lastAlertAt: { type: Date },
    checklistSnapshot: { type: Schema.Types.Mixed },
    submissionNotes: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const TenderSubmissionTracking = mongoose.model<ITenderSubmissionTracking>(
  'TenderSubmissionTracking',
  tenderSubmissionTrackingSchema
);
