import mongoose, { Document, Schema, Types } from 'mongoose';
import { PostAwardAlertPriority, PostAwardAlertType } from '../types/postAward';

export interface IPostAwardAlert extends Document {
  contractId: Types.ObjectId;
  tenderId: Types.ObjectId;
  alertType: PostAwardAlertType;
  priority: PostAwardAlertPriority;
  title: string;
  message: string;
  dueDate?: Date;
  isDismissed: boolean;
  createdAt?: Date;
}

const postAwardAlertSchema = new Schema<IPostAwardAlert>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    alertType: {
      type: String,
      enum: ['contract_expiry', 'amc_expiry', 'agreement_expiry', 'revenue_delay', 'pending_billing'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    dueDate: { type: Date },
    isDismissed: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'post_award_alerts' }
);

postAwardAlertSchema.index({ contractId: 1, alertType: 1, isDismissed: 1 });

export const PostAwardAlert = mongoose.model<IPostAwardAlert>(
  'PostAwardAlert',
  postAwardAlertSchema
);
