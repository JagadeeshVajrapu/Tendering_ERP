import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  ExecutiveRecommendation,
  RecommendationFactor,
} from '../types/executiveRecommendation';

export interface ITenderExecutiveRecommendation extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId?: Types.ObjectId;
  recommendation: ExecutiveRecommendation;
  executiveSummary: string;
  factors: RecommendationFactor[];
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataQualityScore: number;
  dataSource: 'master_dataset';
  processingTimeMs: number;
  schemaVersion: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const factorSchema = new Schema(
  {
    factor: {
      type: String,
      enum: [
        'Tender Value',
        'EMD',
        'Eligibility Criteria',
        'Turnover Requirements',
        'Experience Requirements',
        'Timeline',
        'Compliance',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['Favorable', 'Neutral', 'Concern', 'Critical'],
      required: true,
    },
    summary: { type: String, required: true },
    detail: { type: String, required: true },
    confidence: { type: Number, default: null },
    sourcePage: { type: Number, default: null },
  },
  { _id: false }
);

const tenderExecutiveRecommendationSchema = new Schema<ITenderExecutiveRecommendation>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    recommendation: {
      type: String,
      enum: ['Apply Immediately', 'Apply With Caution', 'Need Manual Review', 'Do Not Apply'],
      required: true,
    },
    executiveSummary: { type: String, required: true },
    factors: { type: [factorSchema], required: true },
    overallRiskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    dataQualityScore: { type: Number, required: true, min: 0, max: 100 },
    dataSource: { type: String, enum: ['master_dataset'], default: 'master_dataset' },
    processingTimeMs: { type: Number, default: 0 },
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

tenderExecutiveRecommendationSchema.index({ tenderId: 1, documentId: 1 }, { unique: true });
tenderExecutiveRecommendationSchema.index({ documentId: 1 }, { unique: true });

export const TenderExecutiveRecommendation = mongoose.model<ITenderExecutiveRecommendation>(
  'TenderExecutiveRecommendation',
  tenderExecutiveRecommendationSchema
);
