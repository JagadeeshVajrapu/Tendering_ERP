import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IPostAwardLog extends Document {
  tenderId: Types.ObjectId;
  contractId?: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  userRole: UserRole;
  action: string;
  message: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  createdAt?: Date;
}

const postAwardLogSchema = new Schema<IPostAwardLog>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: Object.values(UserRole), required: true },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'post_award_logs' }
);

postAwardLogSchema.index({ tenderId: 1, createdAt: -1 });

export const PostAwardLog = mongoose.model<IPostAwardLog>('PostAwardLog', postAwardLogSchema);
