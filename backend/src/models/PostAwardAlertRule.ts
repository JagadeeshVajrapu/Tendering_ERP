import mongoose, { Document, Schema } from 'mongoose';
import { PostAwardAlertPriority, PostAwardAlertType } from '../types/postAward';

export interface IPostAwardAlertRule extends Document {
  alertType: PostAwardAlertType;
  daysBeforeExpiry: number;
  priority: PostAwardAlertPriority;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const postAwardAlertRuleSchema = new Schema<IPostAwardAlertRule>(
  {
    alertType: {
      type: String,
      enum: ['contract_expiry', 'amc_expiry', 'agreement_expiry', 'revenue_delay', 'pending_billing'],
      required: true,
    },
    daysBeforeExpiry: { type: Number, required: true, default: 30 },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
    },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'post_award_alert_rules' }
);

postAwardAlertRuleSchema.index({ alertType: 1, daysBeforeExpiry: 1 }, { unique: true });

export const PostAwardAlertRule = mongoose.model<IPostAwardAlertRule>(
  'PostAwardAlertRule',
  postAwardAlertRuleSchema
);
