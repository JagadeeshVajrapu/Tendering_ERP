import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalyticsSummary extends Document {
  summaryType: string;
  period: string;
  data: Record<string, unknown>;
  filters: Record<string, unknown>;
  computedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const analyticsSummarySchema = new Schema<IAnalyticsSummary>(
  {
    summaryType: { type: String, required: true, index: true },
    period: { type: String, required: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    computedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: 'analytics_summary' }
);

analyticsSummarySchema.index({ summaryType: 1, period: 1 }, { unique: true });

export const AnalyticsSummary = mongoose.model<IAnalyticsSummary>(
  'AnalyticsSummary',
  analyticsSummarySchema
);
