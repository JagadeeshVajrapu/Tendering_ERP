import { Types } from 'mongoose';
import { AuditLog } from '../../models/AuditLog';
import { UserRole } from '../../types';

interface AuditLogInput {
  userId: Types.ObjectId | string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId?: string | Types.ObjectId;
  ipAddress?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

class AuditService {
  async log(input: AuditLogInput): Promise<void> {
    await AuditLog.create({
      userId: input.userId,
      userRole: input.userRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      oldValue: input.oldValue,
      newValue: input.newValue,
      metadata: input.metadata,
    });
  }

  async getLogs(filters: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const query: Record<string, unknown> = {};
    if (filters.userId) query.userId = filters.userId;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);
    return { logs, total, page, limit };
  }
}

export const auditService = new AuditService();
