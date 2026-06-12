import mongoose, { Document, Schema } from 'mongoose';

export interface IDashboardMetric extends Document {
  metricKey: string;
  scope: string;
  value: Record<string, unknown>;
  filtersHash?: string;
  computedAt: Date;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const dashboardMetricSchema = new Schema<IDashboardMetric>(
  {
    metricKey: { type: String, required: true, index: true },
    scope: { type: String, required: true, default: 'global' },
    value: { type: Schema.Types.Mixed, required: true },
    filtersHash: { type: String, index: true },
    computedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true, collection: 'dashboard_metrics' }
);

dashboardMetricSchema.index({ metricKey: 1, scope: 1, filtersHash: 1 }, { unique: true });

export const DashboardMetric = mongoose.model<IDashboardMetric>('DashboardMetric', dashboardMetricSchema);
