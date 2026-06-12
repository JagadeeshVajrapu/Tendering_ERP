import mongoose, { Document, Schema } from 'mongoose';
import { MisExportFormat } from '../types/misReporting';

export interface IMisReport extends Document {
  reportType: string;
  title: string;
  filters: Record<string, unknown>;
  generatedBy?: mongoose.Types.ObjectId;
  format?: MisExportFormat;
  status: 'pending' | 'ready' | 'failed';
  filePath?: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const misReportSchema = new Schema<IMisReport>(
  {
    reportType: { type: String, required: true, index: true },
    title: { type: String, required: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    format: { type: String, enum: ['excel', 'pdf', 'csv'] },
    status: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
    filePath: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'mis_reports' }
);

misReportSchema.index({ reportType: 1, createdAt: -1 });

export const MisReport = mongoose.model<IMisReport>('MisReport', misReportSchema);
