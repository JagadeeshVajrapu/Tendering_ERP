import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenderSummary extends Document {
  tenderId: Types.ObjectId;
  nitAnalysisId: Types.ObjectId;
  tenderName: string;
  tenderAuthority: string;
  scope: string;
  eligibility: string;
  estimatedRevenue: number;
  emdRequirement: string;
  completionTimeline: string;
  riskSummary: string;
  recommendation: 'Proceed' | 'Do Not Proceed';
  recommendationReason: string;
  generatedBy: Types.ObjectId;
  aiGenerated: boolean;
}

const tenderSummarySchema = new Schema<ITenderSummary>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    nitAnalysisId: { type: Schema.Types.ObjectId, ref: 'NitAnalysis', required: true },
    tenderName: { type: String, required: true },
    tenderAuthority: { type: String },
    scope: { type: String },
    eligibility: { type: String },
    estimatedRevenue: { type: Number },
    emdRequirement: { type: String },
    completionTimeline: { type: String },
    riskSummary: { type: String },
    recommendation: { type: String, enum: ['Proceed', 'Do Not Proceed'], required: true },
    recommendationReason: { type: String },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    aiGenerated: { type: Boolean, default: true },
  },
  { timestamps: true }
);

tenderSummarySchema.index({ tenderId: 1 });

export const TenderSummary = mongoose.model<ITenderSummary>('TenderSummary', tenderSummarySchema);
