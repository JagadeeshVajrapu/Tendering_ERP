import mongoose, { Document, Schema, Types } from 'mongoose';



export type FeasibilityRecommendation = 'Suitable' | 'Not Suitable';



export interface TimelineEntry {

  milestone: string;

  date: string;

}



export interface ExecutiveReportSnapshot {

  overviewLines: string[];

  scopeBullets: string[];

  eligibilityBullets: string[];

  eligibilityStatus: string;

  timelineRows: TimelineEntry[];

  recommendation: string;

  recommendationJustification: string;

}



export interface IFeasibilityReport extends Document {

  tenderId: Types.ObjectId;

  analysisId: Types.ObjectId;

  generatedBy: Types.ObjectId;

  scopeSummary: string;

  eligibilitySummary: string;

  timelineSummary: string;

  financialSummary: string;

  keyRisks: string[];

  recommendation: FeasibilityRecommendation;

  intelligenceRecommendation?: string;

  recommendationJustification?: string;

  eligibilityStatus?: string;

  executiveReport?: ExecutiveReportSnapshot;

  enterpriseReport?: unknown;

  schemaVersion?: number;

  approvalStatus?: string;

  decisionHistory?: Array<{
    action: string;
    by: string;
    byRole: string;
    at: string;
    comments?: string;
  }>;

  submittedAt?: Date;

  pdfPath: string;

  pdfFileName: string;

  createdAt: Date;

  updatedAt: Date;

}



const feasibilityReportSchema = new Schema<IFeasibilityReport>(

  {

    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },

    analysisId: { type: Schema.Types.ObjectId, ref: 'TenderAnalysis', required: true },

    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    scopeSummary: { type: String, required: true },

    eligibilitySummary: { type: String, required: true },

    timelineSummary: { type: String, required: true },

    financialSummary: { type: String, default: '' },

    keyRisks: [{ type: String }],

    recommendation: { type: String, enum: ['Suitable', 'Not Suitable'], required: true },

    intelligenceRecommendation: { type: String },

    recommendationJustification: { type: String },

    eligibilityStatus: { type: String },

    executiveReport: {

      overviewLines: [{ type: String }],

      scopeBullets: [{ type: String }],

      eligibilityBullets: [{ type: String }],

      eligibilityStatus: { type: String },

      timelineRows: [

        {

          milestone: { type: String },

          date: { type: String },

        },

      ],

      recommendation: { type: String },

      recommendationJustification: { type: String },

    },

    enterpriseReport: { type: Schema.Types.Mixed },

    schemaVersion: { type: Number, default: 1 },

    approvalStatus: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'review', 'conditional'],
      default: 'draft',
    },

    decisionHistory: { type: Schema.Types.Mixed, default: [] },

    submittedAt: { type: Date },

    pdfPath: { type: String, required: true },

    pdfFileName: { type: String, required: true },

  },

  { timestamps: true }

);



export const FeasibilityReport = mongoose.model<IFeasibilityReport>(

  'FeasibilityReport',

  feasibilityReportSchema

);

