import { Types } from 'mongoose';
import { auditService } from '../audit/auditService';
import { UserRole } from '../../types';

export type PreparationAuditAction =
  | 'document_uploaded'
  | 'document_deleted'
  | 'pdf_unlocked'
  | 'pdf_redacted'
  | 'pdf_annotated'
  | 'pdf_highlighted'
  | 'pdf_stamped'
  | 'workflow_created'
  | 'workflow_started'
  | 'workflow_signed'
  | 'workflow_rejected'
  | 'workflow_completed'
  | 'workflow_cancelled'
  | 'esign_applied'
  | 'dsc_signed'
  | 'dsc_verified'
  | 'signature_validated';

interface LogPreparationEventInput {
  userId: Types.ObjectId | string;
  userRole: UserRole;
  action: PreparationAuditAction;
  tenderId: string;
  documentId?: string;
  workflowId?: string;
  signatureId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

class PreparationAuditService {
  async log(input: LogPreparationEventInput): Promise<void> {
    await auditService.log({
      userId: input.userId,
      userRole: input.userRole,
      action: input.action,
      entityType: 'preparation_document',
      entityId: input.documentId,
      ipAddress: input.ipAddress,
      metadata: {
        tenderId: input.tenderId,
        workflowId: input.workflowId,
        signatureId: input.signatureId,
        ...input.metadata,
      },
    });
  }

  async getDocumentAuditTrail(filters: {
    tenderId: string;
    documentId?: string;
    workflowId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const { AuditLog } = await import('../../models/AuditLog');

    const query: Record<string, unknown> = { entityType: 'preparation_document' };
    if (filters.documentId) query.entityId = new Types.ObjectId(filters.documentId);

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const filtered = logs.filter((log) => {
      const meta = log.metadata as Record<string, unknown> | undefined;
      if (meta?.tenderId !== filters.tenderId) return false;
      if (filters.workflowId && meta?.workflowId !== filters.workflowId) return false;
      return true;
    });

    const total = await AuditLog.countDocuments(query);
    return {
      logs: filtered.map((log) => ({
        id: String(log._id),
        userId: log.userId,
        userRole: log.userRole,
        action: log.action,
        documentId: log.entityId ? String(log.entityId) : undefined,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
    };
  }
}

export const preparationAuditService = new PreparationAuditService();
