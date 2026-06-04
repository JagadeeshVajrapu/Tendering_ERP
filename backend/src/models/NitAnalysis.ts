import mongoose, { Document, Schema, Types } from 'mongoose';
import { RiskLevel } from '../types';

export interface IExtractedNitData {
  tenderAuthority?: string;
  tenderNumber?: string;
  tenderValue?: number;
  emdAmount?: number;
  bgRequirement?: string;
  completionTime?: string;
  eligibilityCriteria?: string[];
  technicalRequirements?: string[];
  submissionDate?: string;
  bidOpeningDate?: string;
  reverseAuction?: boolean;
  mafRequirement?: string;
  scopeOfWork?: string;
  preBidMeeting?: string;
  experienceRequirement?: string;
  turnoverRequirement?: string;
  oemRequirement?: string;
  msmeRequirement?: string;
  gstRequirement?: string;
  panRequirement?: string;
  isoRequirement?: string;
  importantDates?: { label: string; date: string }[];
  requiredDocuments?: string[];
}

export interface IRiskAssessment {
  riskSummary: string;
  disqualificationPoints: string[];
  missingDocuments: string[];
  criticalClauses: string[];
  deadlineRisks: string[];
  financialRisks: string[];
  riskLevel: RiskLevel;
}

export interface INitAnalysis extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  extractedData: IExtractedNitData;
  rawText: string;
  riskAssessment: IRiskAssessment;
  eligibilityScore: number;
  analyzedBy: Types.ObjectId;
  aiModel?: string;
  processingTimeMs?: number;
}

const nitAnalysisSchema = new Schema<INitAnalysis>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    extractedData: { type: Schema.Types.Mixed, required: true },
    rawText: { type: String },
    riskAssessment: { type: Schema.Types.Mixed, required: true },
    eligibilityScore: { type: Number, default: 0, min: 0, max: 100 },
    analyzedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    aiModel: { type: String },
    processingTimeMs: { type: Number },
  },
  { timestamps: true }
);

nitAnalysisSchema.index({ tenderId: 1 });

export const NitAnalysis = mongoose.model<INitAnalysis>('NitAnalysis', nitAnalysisSchema);
