import mongoose, { Document, Schema } from 'mongoose';
import { MisAlertPriority, MisAlertType } from '../types/misReporting';

export interface IManagementAlert extends Document {
  alertType: MisAlertType;
  priority: MisAlertPriority;
  title: string;
  message: string;
  tenderId?: mongoose.Types.ObjectId;
  contractId?: mongoose.Types.ObjectId;
  module: string;
  dueDate?: Date;
  isDismissed: boolean;
  sourceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const managementAlertSchema = new Schema<IManagementAlert>(
  {
    alertType: { type: String, required: true, index: true },
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', index: true },
    module: { type: String, required: true },
    dueDate: { type: Date, index: true },
    isDismissed: { type: Boolean, default: false, index: true },
    sourceId: { type: String, index: true },
  },
  { timestamps: true, collection: 'management_alerts' }
);

managementAlertSchema.index({ sourceId: 1, alertType: 1 }, { unique: true, sparse: true });

export const ManagementAlert = mongoose.model<IManagementAlert>('ManagementAlert', managementAlertSchema);
