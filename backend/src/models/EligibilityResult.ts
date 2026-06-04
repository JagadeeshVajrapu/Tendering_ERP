import mongoose, { Document, Schema, Types } from 'mongoose';
import { EligibilityStatus } from '../types';

export interface IRuleCheck {
  rule: string;
  passed: boolean;
  message: string;
  weight: number;
}

export interface IEligibilityResult extends Document {
  tenderId: Types.ObjectId;
  nitAnalysisId: Types.ObjectId;
  status: EligibilityStatus;
  score: number;
  ruleChecks: IRuleCheck[];
  summary: string;
  recommendations: string[];
}

const eligibilityResultSchema = new Schema<IEligibilityResult>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    nitAnalysisId: { type: Schema.Types.ObjectId, ref: 'NitAnalysis', required: true },
    status: {
      type: String,
      enum: Object.values(EligibilityStatus),
      required: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    ruleChecks: [{ rule: String, passed: Boolean, message: String, weight: Number }],
    summary: { type: String },
    recommendations: [{ type: String }],
  },
  { timestamps: true }
);

eligibilityResultSchema.index({ tenderId: 1 });

export const EligibilityResult = mongoose.model<IEligibilityResult>('EligibilityResult', eligibilityResultSchema);
