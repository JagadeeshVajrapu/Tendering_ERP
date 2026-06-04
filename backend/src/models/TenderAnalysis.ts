import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IImportantDate {
  label: string;
  date: string;
}

export interface ITenderAnalysisData {
  tenderName: string;
  department: string;
  organization: string;
  tenderNumber: string;
  estimatedValue: string;
  emdAmount: string;
  bgRequirement: string;
  bidSubmissionDate: string;
  preBidMeetingDate: string;
  contractDuration: string;
  scopeOfWork: string;
  eligibilityCriteria: string[];
  technicalRequirements: string[];
  reverseAuction: string;
  mafRequired: string;
  requiredDocuments: string[];
  importantDates: IImportantDate[];
  paymentTerms: string;
  riskFactors: string[];
  aiRecommendation: string;
}

export interface ITenderAnalysis extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  analyzedBy: Types.ObjectId;
  tenderName: string;
  department: string;
  organization: string;
  tenderNumber: string;
  estimatedValue: string;
  emdAmount: string;
  bgRequirement: string;
  bidSubmissionDate: string;
  preBidMeetingDate: string;
  contractDuration: string;
  scopeOfWork: string;
  eligibilityCriteria: string[];
  technicalRequirements: string[];
  reverseAuction: string;
  mafRequired: string;
  requiredDocuments: string[];
  importantDates: IImportantDate[];
  paymentTerms: string;
  riskFactors: string[];
  aiRecommendation: string;
  rawText?: string;
  aiModel?: string;
  processingTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

const importantDateSchema = new Schema(
  { label: { type: String, default: '' }, date: { type: String, default: '' } },
  { _id: false }
);

const tenderAnalysisSchema = new Schema<ITenderAnalysis>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    analyzedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tenderName: { type: String, default: '' },
    department: { type: String, default: '' },
    organization: { type: String, default: '' },
    tenderNumber: { type: String, default: '' },
    estimatedValue: { type: String, default: '' },
    emdAmount: { type: String, default: '' },
    bgRequirement: { type: String, default: '' },
    bidSubmissionDate: { type: String, default: '' },
    preBidMeetingDate: { type: String, default: '' },
    contractDuration: { type: String, default: '' },
    scopeOfWork: { type: String, default: '' },
    eligibilityCriteria: [{ type: String }],
    technicalRequirements: [{ type: String }],
    reverseAuction: { type: String, default: '' },
    mafRequired: { type: String, default: '' },
    requiredDocuments: [{ type: String }],
    importantDates: [importantDateSchema],
    paymentTerms: { type: String, default: '' },
    riskFactors: [{ type: String }],
    aiRecommendation: { type: String, default: '' },
    rawText: { type: String },
    aiModel: { type: String },
    processingTimeMs: { type: Number },
  },
  { timestamps: true }
);

export const TenderAnalysis = mongoose.model<ITenderAnalysis>('TenderAnalysis', tenderAnalysisSchema);
