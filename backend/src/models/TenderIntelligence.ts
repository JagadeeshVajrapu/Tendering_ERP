import mongoose, { Document, Schema, Types } from 'mongoose';
import { FeasibilityRecommendation, MdReport, MergedField, NitAnalysisSheet } from '../types/intelligence';

export interface ITenderIntelligence extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId: Types.ObjectId;
  analyzedBy: Types.ObjectId;
  pageCount: number;
  chunkCount: number;
  phase: 'processing' | 'complete';
  merged: Record<string, MergedField>;
  documentMap?: Record<string, unknown>;
  nitTables?: NitAnalysisSheet;
  /** Consultant-grade verified NIT — scalar fields only, no paragraphs. */
  verifiedNit?: Record<string, string | string[]>;
  productionFields?: Array<{
    id: string;
    label: string;
    mergeKey: string;
    section: string;
    value: string | string[] | null;
    sourcePage: number;
    sourceText?: string;
    confidence: number;
    validated: boolean;
    needsReview: boolean;
  }>;
  executiveBullets?: string[];
  mdReport?: MdReport;
  scopeSummary: string;
  eligibilitySummary: string;
  timelineSummary: string;
  financialSummary: string;
  riskSummary: string;
  riskAnalysis?: {
    items: Array<{
      category: string;
      level: string;
      explanation: string;
      confidence: number;
    }>;
    overallLevel: string;
    prerequisites: Record<string, boolean>;
    processingTimeMs: number;
  };
  recommendation: FeasibilityRecommendation;
  aiModel: string;
  processingTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const mergedFieldSchema = new Schema(
  {
    value: { type: Schema.Types.Mixed },
    sourcePages: [{ type: Number }],
    confidence: { type: Number, default: 0 },
    validated: { type: Boolean, default: false },
    allExtractions: [
      {
        value: { type: Schema.Types.Mixed },
        page: { type: Number },
        confidence: { type: Number },
      },
    ],
  },
  { _id: false }
);

const tenderIntelligenceSchema = new Schema<ITenderIntelligence>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', required: true },
    analyzedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    phase: { type: String, enum: ['processing', 'complete'], default: 'processing' },
    merged: { type: Schema.Types.Mixed, default: {} },
    documentMap: { type: Schema.Types.Mixed },
    nitTables: { type: Schema.Types.Mixed },
    verifiedNit: { type: Schema.Types.Mixed },
    productionFields: { type: Schema.Types.Mixed },
    executiveBullets: [{ type: String }],
    mdReport: { type: Schema.Types.Mixed },
    scopeSummary: { type: String, default: '' },
    eligibilitySummary: { type: String, default: '' },
    timelineSummary: { type: String, default: '' },
    financialSummary: { type: String, default: '' },
    riskSummary: { type: String, default: '' },
    riskAnalysis: { type: Schema.Types.Mixed },
    recommendation: {
      type: String,
      enum: ['Apply', 'Apply with Caution', 'Do Not Apply'],
      default: 'Apply with Caution',
    },
    aiModel: { type: String, default: '' },
    processingTimeMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tenderIntelligenceSchema.index({ tenderId: 1, createdAt: -1 });

export const TenderIntelligence = mongoose.model<ITenderIntelligence>(
  'TenderIntelligence',
  tenderIntelligenceSchema
);
