import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  TenderRiskItem,
  TenderRiskLevel,
  TenderRiskPrerequisites,
} from '../types/tenderRiskAnalysis';

export interface ITenderRiskAnalysis extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId?: Types.ObjectId;
  risks: TenderRiskItem[];
  overallLevel: TenderRiskLevel;
  prerequisites: TenderRiskPrerequisites;
  dataSource: 'master_dataset';
  processingTimeMs: number;
  schemaVersion: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const riskItemSchema = new Schema(
  {
    riskType: {
      type: String,
      enum: [
        'Financial Risk',
        'Technical Risk',
        'Eligibility Risk',
        'Timeline Risk',
        'Compliance Risk',
      ],
      required: true,
    },
    level: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    reason: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const tenderRiskAnalysisSchema = new Schema<ITenderRiskAnalysis>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    risks: { type: [riskItemSchema], required: true },
    overallLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    prerequisites: {
      extractionComplete: { type: Boolean, default: false },
      validationComplete: { type: Boolean, default: false },
      masterDatasetReady: { type: Boolean, default: false },
    },
    dataSource: { type: String, enum: ['master_dataset'], default: 'master_dataset' },
    processingTimeMs: { type: Number, default: 0 },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

tenderRiskAnalysisSchema.index({ tenderId: 1, documentId: 1 }, { unique: true });
tenderRiskAnalysisSchema.index({ documentId: 1 }, { unique: true });

export const TenderRiskAnalysis = mongoose.model<ITenderRiskAnalysis>(
  'TenderRiskAnalysis',
  tenderRiskAnalysisSchema
);
