import mongoose, { Document, Schema, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IAuditLog extends Document {
  userId: Types.ObjectId;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  ipAddress?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: Object.values(UserRole), required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
