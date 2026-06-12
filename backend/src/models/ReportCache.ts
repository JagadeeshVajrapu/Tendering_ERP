import mongoose, { Document, Schema } from 'mongoose';

export interface IReportCache extends Document {
  cacheKey: string;
  section: string;
  payload: Record<string, unknown>;
  filters: Record<string, unknown>;
  computedAt: Date;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const reportCacheSchema = new Schema<IReportCache>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    section: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    computedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, collection: 'report_cache' }
);

export const ReportCache = mongoose.model<IReportCache>('ReportCache', reportCacheSchema);
