import mongoose, { Document, Schema, Types } from 'mongoose';
import { FinanceNotificationEvent } from '../types/financeWorkflow';

export interface IFinanceWorkflowNotification extends Document {
  tenderId?: Types.ObjectId;
  userId?: Types.ObjectId;
  event: FinanceNotificationEvent;
  title: string;
  message: string;
  entityType?: string;
  entityId?: Types.ObjectId;
  isRead: boolean;
  emailReady: boolean;
  createdAt?: Date;
}

const financeWorkflowNotificationSchema = new Schema<IFinanceWorkflowNotification>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    event: {
      type: String,
      enum: [
        'approval_request',
        'refund_submitted',
        'approval_completed',
        'approval_rejected',
        'bg_expiry_alert',
        'pbg_expiry_alert',
        'refund_pending_alert',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false },
    emailReady: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_notifications' }
);

financeWorkflowNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const FinanceWorkflowNotification = mongoose.model<IFinanceWorkflowNotification>(
  'FinanceWorkflowNotification',
  financeWorkflowNotificationSchema
);
