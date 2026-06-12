import { FilterQuery, Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { FinanceRecord } from '../../models/FinanceRecord';
import { RefundRecord } from '../../models/RefundRecord';
import { FinanceAlert } from '../../models/FinanceAlert';
import { FinanceWorkflowRequest, IFinanceWorkflowRequest } from '../../models/FinanceWorkflowRequest';
import { FinanceApproval } from '../../models/FinanceApproval';
import { FinanceTask } from '../../models/FinanceTask';
import { FinanceWorkflowNotification } from '../../models/FinanceWorkflowNotification';
import { FinanceComment } from '../../models/FinanceComment';
import { FinanceWorkflowAuditLog } from '../../models/FinanceWorkflowAuditLog';
import { NotificationType, UserRole } from '../../types';
import {
  AddFinanceCommentInput,
  ApproveRejectInput,
  CreateFinanceTaskInput,
  CreateFinanceWorkflowRequestInput,
  CreateRefundWorkflowInput,
  CreateRenewalRequestInput,
  FinanceApprovalDashboardDto,
  FinanceApprovalDto,
  FinanceTaskDto,
  FinanceWorkflowAuditDto,
  FinanceWorkflowCommentDto,
  FinanceWorkflowListQuery,
  FinanceWorkflowNotificationDto,
  FinanceWorkflowRequestDto,
  FinanceWorkflowStatus,
} from '../../types/financeWorkflow';
import { notificationService } from '../notification/notificationService';
import { auditService } from '../audit/auditService';

interface RequestContext {
  userId: Types.ObjectId;
  userRole: UserRole;
  userName: string;
  ipAddress?: string;
}

const DISPLAY_STATUS: Record<FinanceWorkflowStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_finance: 'Under Review',
  pending_manager: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
};

const REFUND_TYPES = ['REFUND_EMD', 'REFUND_SECURITY_DEPOSIT', 'PBG_RELEASE'] as const;
const RENEWAL_TYPES = ['BG_RENEWAL', 'PBG_RENEWAL'] as const;

function parseDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

class FinanceWorkflowService {
  private async generateRequestNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `FR-${today}-`;
    const count = await FinanceWorkflowRequest.countDocuments({
      requestNumber: { $regex: `^${prefix}` },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private mapRequest(doc: Record<string, unknown>): FinanceWorkflowRequestDto {
    const tender = doc.tenderId as { title?: string; _id?: Types.ObjectId } | Types.ObjectId | undefined;
    const requester = doc.requestedBy as { name?: string; _id?: Types.ObjectId } | Types.ObjectId | undefined;
    const tenderObj = tender && typeof tender === 'object' && 'title' in tender ? tender : null;
    const requesterObj = requester && typeof requester === 'object' && 'name' in requester ? requester : null;
    return {
      id: String(doc._id),
      requestNumber: String(doc.requestNumber),
      tenderId: tenderObj?._id ? String(tenderObj._id) : String(tender),
      tenderName: tenderObj?.title,
      requestType: doc.requestType as FinanceWorkflowRequestDto['requestType'],
      amount: Number(doc.amount),
      requestedBy: requesterObj?._id ? String(requesterObj._id) : String(requester),
      requestedByName: requesterObj?.name,
      status: doc.status as FinanceWorkflowStatus,
      displayStatus: DISPLAY_STATUS[doc.status as FinanceWorkflowStatus],
      currentApproverRole: doc.currentApproverRole as string | undefined,
      approvalStep: Number(doc.approvalStep ?? 0),
      approvalDate: doc.approvalDate ? new Date(String(doc.approvalDate)).toISOString() : undefined,
      rejectionReason: doc.rejectionReason as string | undefined,
      remarks: doc.remarks as string | undefined,
      financeRecordId: doc.financeRecordId ? String(doc.financeRecordId) : undefined,
      refundRecordId: doc.refundRecordId ? String(doc.refundRecordId) : undefined,
      renewalOriginalRecordId: doc.renewalOriginalRecordId ? String(doc.renewalOriginalRecordId) : undefined,
      renewalDate: doc.renewalDate ? new Date(String(doc.renewalDate)).toISOString() : undefined,
      newExpiryDate: doc.newExpiryDate ? new Date(String(doc.newExpiryDate)).toISOString() : undefined,
      renewalStatus: doc.renewalStatus as string | undefined,
      createdAt: doc.createdAt
        ? new Date(String(doc.createdAt)).toISOString()
        : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)).toISOString() : undefined,
    };
  }

  private async audit(
    tenderId: string,
    ctx: RequestContext,
    action: string,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    await FinanceWorkflowAuditLog.create({
      tenderId: new Types.ObjectId(tenderId),
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: ctx.userRole,
      action,
      message,
      ipAddress: ctx.ipAddress,
      metadata,
    });

    await auditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action,
      entityType: 'finance_workflow',
      entityId: tenderId,
      ipAddress: ctx.ipAddress,
      metadata: { tenderId, ...metadata },
    });
  }

  private async emitFinanceNotification(
    event: FinanceWorkflowNotificationDto['event'],
    title: string,
    message: string,
    opts: {
      tenderId?: string;
      userId?: string;
      entityType?: string;
      entityId?: string;
      notifyRole?: UserRole;
    }
  ) {
    const record = await FinanceWorkflowNotification.create({
      tenderId: opts.tenderId ? new Types.ObjectId(opts.tenderId) : undefined,
      userId: opts.userId ? new Types.ObjectId(opts.userId) : undefined,
      event,
      title,
      message,
      entityType: opts.entityType,
      entityId: opts.entityId ? new Types.ObjectId(opts.entityId) : undefined,
      emailReady: true,
    });

    const notifType =
      event.includes('alert') || event === 'refund_pending_alert'
        ? NotificationType.SYSTEM
        : NotificationType.FINANCE_REQUEST;

    if (opts.userId) {
      await notificationService.notifyUser(
        opts.userId,
        notifType,
        title,
        message,
        opts.entityType || 'FinanceWorkflowRequest',
        opts.entityId || String(record._id)
      );
    } else if (opts.notifyRole) {
      await notificationService.notifyRole(
        opts.notifyRole,
        notifType,
        title,
        message,
        opts.entityType || 'FinanceWorkflowRequest',
        opts.entityId || String(record._id)
      );
    }
  }

  private async createApprovalSteps(request: IFinanceWorkflowRequest) {
    await FinanceApproval.create([
      {
        requestId: request._id,
        tenderId: request.tenderId,
        approverRole: UserRole.FINANCE,
        step: 1,
        decision: 'pending',
      },
      {
        requestId: request._id,
        tenderId: request.tenderId,
        approverRole: UserRole.MANAGER,
        step: 2,
        decision: 'pending',
      },
    ]);
  }

  private async submitRequest(request: IFinanceWorkflowRequest, ctx: RequestContext) {
    request.status = 'pending_finance';
    request.currentApproverRole = UserRole.FINANCE;
    request.approvalStep = 1;
    await request.save();
    await this.createApprovalSteps(request);

    await this.audit(String(request.tenderId), ctx, 'approval_created', `Submitted ${request.requestType}`, {
      requestId: String(request._id),
      requestNumber: request.requestNumber,
    });

    await this.emitFinanceNotification(
      REFUND_TYPES.includes(request.requestType as (typeof REFUND_TYPES)[number])
        ? 'refund_submitted'
        : 'approval_request',
      `New finance request ${request.requestNumber}`,
      `${request.requestType} for ₹${request.amount.toLocaleString('en-IN')} requires finance review.`,
      {
        tenderId: String(request.tenderId),
        entityType: 'FinanceWorkflowRequest',
        entityId: String(request._id),
        notifyRole: UserRole.FINANCE,
      }
    );
  }

  private async autoCreateTask(
    tenderId: string,
    ctx: RequestContext,
    task: {
      taskType: CreateFinanceTaskInput['taskType'];
      title: string;
      description?: string;
      relatedRequestId?: string;
      relatedRecordId?: string;
      assignedTo?: string;
    }
  ) {
    const existing = await FinanceTask.findOne({
      tenderId: new Types.ObjectId(tenderId),
      title: task.title,
      status: { $ne: 'completed' },
      relatedRecordId: task.relatedRecordId
        ? new Types.ObjectId(task.relatedRecordId)
        : undefined,
    });
    if (existing) return existing;

    return FinanceTask.create({
      tenderId: new Types.ObjectId(tenderId),
      taskType: task.taskType,
      title: task.title,
      description: task.description,
      status: 'pending',
      createdBy: ctx.userId,
      relatedRequestId: task.relatedRequestId
        ? new Types.ObjectId(task.relatedRequestId)
        : undefined,
      relatedRecordId: task.relatedRecordId
        ? new Types.ObjectId(task.relatedRecordId)
        : undefined,
      assignedTo: task.assignedTo ? new Types.ObjectId(task.assignedTo) : undefined,
    });
  }

  async createRequest(
    tenderId: string,
    ctx: RequestContext,
    input: CreateFinanceWorkflowRequestInput
  ): Promise<FinanceWorkflowRequestDto> {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const request = await FinanceWorkflowRequest.create({
      requestNumber: await this.generateRequestNumber(),
      tenderId: new Types.ObjectId(tenderId),
      requestType: input.requestType,
      amount: input.amount,
      requestedBy: ctx.userId,
      status: 'draft',
      approvalStep: 0,
      remarks: input.remarks,
      financeRecordId: input.financeRecordId
        ? new Types.ObjectId(input.financeRecordId)
        : undefined,
      refundRecordId: input.refundRecordId ? new Types.ObjectId(input.refundRecordId) : undefined,
    });

    await this.audit(tenderId, ctx, 'approval_created', `Created draft ${request.requestType}`, {
      requestId: String(request._id),
    });

    if (input.submit) {
      await this.submitRequest(request, ctx);
    }

    const populated = await FinanceWorkflowRequest.findById(request._id)
      .populate('tenderId', 'title')
      .populate('requestedBy', 'name')
      .lean();
    return this.mapRequest(populated as unknown as Record<string, unknown>);
  }

  async createRefundRequest(
    tenderId: string,
    ctx: RequestContext,
    input: CreateRefundWorkflowInput
  ): Promise<FinanceWorkflowRequestDto> {
    return this.createRequest(tenderId, ctx, {
      requestType: input.refundType,
      amount: input.amount,
      remarks: input.remarks,
      financeRecordId: input.financeRecordId,
      refundRecordId: input.refundRecordId,
      submit: input.submit ?? true,
    });
  }

  async createRenewalRequest(
    tenderId: string,
    ctx: RequestContext,
    input: CreateRenewalRequestInput
  ): Promise<FinanceWorkflowRequestDto> {
    const record = await FinanceRecord.findOne({
      _id: new Types.ObjectId(input.financeRecordId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!record) throw new AppError('Finance record not found', 404);

    const request = await FinanceWorkflowRequest.create({
      requestNumber: await this.generateRequestNumber(),
      tenderId: new Types.ObjectId(tenderId),
      requestType: input.renewalType,
      amount: input.amount ?? record.amount,
      requestedBy: ctx.userId,
      status: 'draft',
      approvalStep: 0,
      remarks: input.remarks,
      financeRecordId: record._id,
      renewalOriginalRecordId: record._id,
      renewalDate: parseDate(input.renewalDate) || new Date(),
      newExpiryDate: parseDate(input.newExpiryDate),
      renewalStatus: 'pending',
    });

    await this.autoCreateTask(tenderId, ctx, {
      taskType: input.renewalType === 'BG_RENEWAL' ? 'renew_bg' : 'renew_pbg',
      title: `${input.renewalType === 'BG_RENEWAL' ? 'Renew BG' : 'Renew PBG'} — ${record.instrumentNumber || record.referenceNumber || record.recordType}`,
      description: input.remarks,
      relatedRequestId: String(request._id),
      relatedRecordId: String(record._id),
    });

    if (input.submit ?? true) {
      await this.submitRequest(request, ctx);
    }

    const populated = await FinanceWorkflowRequest.findById(request._id)
      .populate('tenderId', 'title')
      .populate('requestedBy', 'name')
      .lean();
    return this.mapRequest(populated as unknown as Record<string, unknown>);
  }

  async listRequests(query: FinanceWorkflowListQuery, ctx: RequestContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const filter: FilterQuery<IFinanceWorkflowRequest> = {};

    if (query.tenderId) filter.tenderId = new Types.ObjectId(query.tenderId);
    if (query.requestType) filter.requestType = query.requestType;

    if (query.status === 'pending') {
      filter.status = { $in: ['pending_finance', 'pending_manager', 'submitted'] };
    } else if (query.status === 'completed') {
      filter.status = 'completed';
    } else if (query.status) {
      filter.status = query.status;
    }

    if (ctx.userRole === UserRole.EXECUTIVE) {
      filter.requestedBy = ctx.userId;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { requestNumber: { $regex: term, $options: 'i' } },
        { remarks: { $regex: term, $options: 'i' } },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const total = await FinanceWorkflowRequest.countDocuments(filter);
    const items = await FinanceWorkflowRequest.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('tenderId', 'title')
      .populate('requestedBy', 'name')
      .lean();

    return {
      items: items.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private canApprove(request: IFinanceWorkflowRequest, ctx: RequestContext): boolean {
    if (request.status === 'pending_finance' && ctx.userRole === UserRole.FINANCE) return true;
    if (request.status === 'pending_manager' && ctx.userRole === UserRole.MANAGER) return true;
    return false;
  }

  async approveRequest(
    requestId: string,
    ctx: RequestContext,
    input: ApproveRejectInput
  ): Promise<FinanceWorkflowRequestDto> {
    const request = await FinanceWorkflowRequest.findById(requestId);
    if (!request) throw new AppError('Finance request not found', 404);
    if (!this.canApprove(request, ctx)) {
      throw new AppError('You are not authorized to approve this request at the current step', 403);
    }

    const step = request.approvalStep;
    await FinanceApproval.findOneAndUpdate(
      { requestId: request._id, step },
      {
        decision: 'approved',
        approverUserId: ctx.userId,
        comments: input.comments,
        decidedAt: new Date(),
      }
    );

    if (input.comments) {
      await FinanceComment.create({
        tenderId: request.tenderId,
        requestId: request._id,
        userId: ctx.userId,
        userName: ctx.userName,
        userRole: ctx.userRole,
        commentType: 'approval_comment',
        content: input.comments,
      });
    }

    if (request.status === 'pending_finance') {
      request.status = 'pending_manager';
      request.currentApproverRole = UserRole.MANAGER;
      request.approvalStep = 2;
      await request.save();

      await this.audit(String(request.tenderId), ctx, 'approval_updated', `Finance approved ${request.requestNumber}`, {
        requestId,
        step: 1,
      });

      await this.emitFinanceNotification(
        'approval_request',
        `Finance approval required — ${request.requestNumber}`,
        `Step 2 manager approval needed for ${request.requestType}.`,
        {
          tenderId: String(request.tenderId),
          entityId: String(request._id),
          notifyRole: UserRole.MANAGER,
        }
      );
    } else {
      request.status = REFUND_TYPES.includes(request.requestType as (typeof REFUND_TYPES)[number])
        ? 'completed'
        : 'approved';
      request.approvalDate = new Date();
      request.currentApproverRole = undefined;
      await request.save();

      if (RENEWAL_TYPES.includes(request.requestType as (typeof RENEWAL_TYPES)[number])) {
        request.renewalStatus = 'approved';
        if (request.financeRecordId && request.newExpiryDate) {
          await FinanceRecord.findByIdAndUpdate(request.financeRecordId, {
            expiryDate: request.newExpiryDate,
            status: 'Active',
          });
        }
        await request.save();
      }

      await this.audit(String(request.tenderId), ctx, 'approval_approved', `Approved ${request.requestNumber}`, {
        requestId,
      });

      await this.emitFinanceNotification(
        'approval_completed',
        `Request approved — ${request.requestNumber}`,
        `Your ${request.requestType} request has been fully approved.`,
        {
          tenderId: String(request.tenderId),
          userId: String(request.requestedBy),
          entityId: String(request._id),
        }
      );
    }

    const populated = await FinanceWorkflowRequest.findById(request._id)
      .populate('tenderId', 'title')
      .populate('requestedBy', 'name')
      .lean();
    return this.mapRequest(populated as unknown as Record<string, unknown>);
  }

  async rejectRequest(
    requestId: string,
    ctx: RequestContext,
    input: ApproveRejectInput
  ): Promise<FinanceWorkflowRequestDto> {
    const request = await FinanceWorkflowRequest.findById(requestId);
    if (!request) throw new AppError('Finance request not found', 404);
    if (!this.canApprove(request, ctx)) {
      throw new AppError('You are not authorized to reject this request at the current step', 403);
    }

    request.status = 'rejected';
    request.rejectionReason = input.rejectionReason || input.comments || 'Rejected';
    request.currentApproverRole = undefined;
    await request.save();

    await FinanceApproval.findOneAndUpdate(
      { requestId: request._id, step: request.approvalStep },
      {
        decision: 'rejected',
        approverUserId: ctx.userId,
        comments: input.comments || input.rejectionReason,
        decidedAt: new Date(),
      }
    );

    await this.audit(String(request.tenderId), ctx, 'approval_rejected', `Rejected ${request.requestNumber}`, {
      requestId,
      reason: request.rejectionReason,
    });

    await this.emitFinanceNotification(
      'approval_rejected',
      `Request rejected — ${request.requestNumber}`,
      request.rejectionReason || 'Your finance request was rejected.',
      {
        tenderId: String(request.tenderId),
        userId: String(request.requestedBy),
        entityId: String(request._id),
      }
    );

    const populated = await FinanceWorkflowRequest.findById(request._id)
      .populate('tenderId', 'title')
      .populate('requestedBy', 'name')
      .lean();
    return this.mapRequest(populated as unknown as Record<string, unknown>);
  }

  async getApprovalDashboard(ctx: RequestContext): Promise<FinanceApprovalDashboardDto> {
    const baseFilter: FilterQuery<IFinanceWorkflowRequest> = {};
    if (ctx.userRole === UserRole.EXECUTIVE) {
      baseFilter.requestedBy = ctx.userId;
    }

    const pendingStatuses = ['pending_finance', 'pending_manager', 'submitted'];
    const [pending, approved, rejected, completed, refunds, bgRenewals, pbgRenewals, tasks, notifications, auditLogs] =
      await Promise.all([
        FinanceWorkflowRequest.find({ ...baseFilter, status: { $in: pendingStatuses } })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceWorkflowRequest.find({ ...baseFilter, status: 'approved' })
          .sort({ approvalDate: -1 })
          .limit(30)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceWorkflowRequest.find({ ...baseFilter, status: 'rejected' })
          .sort({ updatedAt: -1 })
          .limit(30)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceWorkflowRequest.find({ ...baseFilter, status: 'completed' })
          .sort({ updatedAt: -1 })
          .limit(30)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceWorkflowRequest.find({
          ...baseFilter,
          requestType: { $in: REFUND_TYPES },
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceWorkflowRequest.find({ ...baseFilter, requestType: 'BG_RENEWAL' })
          .sort({ createdAt: -1 })
          .limit(30)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceWorkflowRequest.find({ ...baseFilter, requestType: 'PBG_RENEWAL' })
          .sort({ createdAt: -1 })
          .limit(30)
          .populate('tenderId', 'title')
          .populate('requestedBy', 'name')
          .lean(),
        FinanceTask.find({ status: { $ne: 'completed' } })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('tenderId', 'title')
          .populate('assignedTo', 'name')
          .lean(),
        FinanceWorkflowNotification.find({
          $or: [{ userId: ctx.userId }, { userId: { $exists: false } }],
        })
          .sort({ createdAt: -1 })
          .limit(30)
          .lean(),
        FinanceWorkflowAuditLog.find()
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
      ]);

    const [pendingCount, approvedCount, pendingRefunds, bgAlerts, pbgAlerts, taskCount] = await Promise.all([
      FinanceWorkflowRequest.countDocuments({ status: { $in: pendingStatuses } }),
      FinanceWorkflowRequest.countDocuments({ status: 'approved' }),
      RefundRecord.countDocuments({ status: { $in: ['pending', 'requested', 'approved'] } }),
      FinanceAlert.countDocuments({ recordType: 'BG', alertLevel: { $in: ['30_days', '15_days', '7_days'] } }),
      FinanceAlert.countDocuments({ recordType: 'PBG', alertLevel: { $in: ['30_days', '15_days', '7_days'] } }),
      FinanceTask.countDocuments({ status: { $ne: 'completed' } }),
    ]);

    return {
      widgets: {
        totalPendingApprovals: pendingCount,
        totalApprovedRequests: approvedCount,
        totalPendingRefunds: pendingRefunds,
        bgExpiringSoon: bgAlerts,
        pbgExpiringSoon: pbgAlerts,
        totalFinanceTasks: taskCount,
      },
      pendingApprovals: pending.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      approvedRequests: approved.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      rejectedRequests: rejected.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      completedRequests: completed.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      refundRequests: refunds.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      bgRenewals: bgRenewals.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      pbgRenewals: pbgRenewals.map((r) => this.mapRequest(r as unknown as Record<string, unknown>)),
      tasks: tasks.map((t) => ({
        id: String(t._id),
        tenderId: String(t.tenderId),
        tenderName: (t.tenderId as { title?: string })?.title,
        taskType: t.taskType,
        title: t.title,
        description: t.description,
        status: t.status,
        assignedTo: t.assignedTo ? String(t.assignedTo) : undefined,
        assignedToName: (t.assignedTo as { name?: string })?.name,
        relatedRequestId: t.relatedRequestId ? String(t.relatedRequestId) : undefined,
        relatedRecordId: t.relatedRecordId ? String(t.relatedRecordId) : undefined,
        dueDate: t.dueDate?.toISOString(),
        createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
        completedAt: t.completedAt?.toISOString(),
      })),
      notifications: notifications.map((n) => ({
        id: String(n._id),
        tenderId: n.tenderId ? String(n.tenderId) : undefined,
        userId: n.userId ? String(n.userId) : undefined,
        event: n.event,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId ? String(n.entityId) : undefined,
        isRead: n.isRead,
        createdAt: n.createdAt?.toISOString() || new Date().toISOString(),
      })),
      auditLogs: auditLogs.map((l) => ({
        id: String(l._id),
        tenderId: String(l.tenderId),
        userId: String(l.userId),
        userName: l.userName,
        userRole: l.userRole,
        action: l.action,
        message: l.message,
        ipAddress: l.ipAddress,
        metadata: l.metadata,
        createdAt: l.createdAt?.toISOString() || new Date().toISOString(),
      })),
    };
  }

  async createTask(
    tenderId: string,
    ctx: RequestContext,
    input: CreateFinanceTaskInput
  ): Promise<FinanceTaskDto> {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const task = await FinanceTask.create({
      tenderId: new Types.ObjectId(tenderId),
      taskType: input.taskType,
      title: input.title,
      description: input.description,
      status: 'pending',
      assignedTo: input.assignedTo ? new Types.ObjectId(input.assignedTo) : undefined,
      createdBy: ctx.userId,
      relatedRequestId: input.relatedRequestId
        ? new Types.ObjectId(input.relatedRequestId)
        : undefined,
      relatedRecordId: input.relatedRecordId ? new Types.ObjectId(input.relatedRecordId) : undefined,
      dueDate: parseDate(input.dueDate),
    });

    await this.audit(tenderId, ctx, 'task_created', `Created task: ${input.title}`, {
      taskId: String(task._id),
    });

    return {
      id: String(task._id),
      tenderId,
      tenderName: tender.title,
      taskType: task.taskType,
      title: task.title,
      description: task.description,
      status: task.status,
      assignedTo: task.assignedTo ? String(task.assignedTo) : undefined,
      relatedRequestId: task.relatedRequestId ? String(task.relatedRequestId) : undefined,
      relatedRecordId: task.relatedRecordId ? String(task.relatedRecordId) : undefined,
      dueDate: task.dueDate?.toISOString(),
      createdAt: task.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  async listTasks(query: { tenderId?: string; status?: string; assignedTo?: string }) {
    const filter: FilterQuery<typeof FinanceTask> = {};
    if (query.tenderId) filter.tenderId = new Types.ObjectId(query.tenderId);
    if (query.status) filter.status = query.status;
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);

    const tasks = await FinanceTask.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('tenderId', 'title')
      .populate('assignedTo', 'name')
      .lean();

    return tasks.map((t) => ({
      id: String(t._id),
      tenderId: String(t.tenderId),
      tenderName: (t.tenderId as { title?: string })?.title,
      taskType: t.taskType,
      title: t.title,
      description: t.description,
      status: t.status,
      assignedTo: t.assignedTo ? String(t.assignedTo) : undefined,
      assignedToName: (t.assignedTo as { name?: string })?.name,
      relatedRequestId: t.relatedRequestId ? String(t.relatedRequestId) : undefined,
      relatedRecordId: t.relatedRecordId ? String(t.relatedRecordId) : undefined,
      dueDate: t.dueDate?.toISOString(),
      createdAt: t.createdAt?.toISOString() || new Date().toISOString(),
      completedAt: t.completedAt?.toISOString(),
    }));
  }

  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed',
    ctx: RequestContext
  ) {
    const task = await FinanceTask.findById(taskId);
    if (!task) throw new AppError('Task not found', 404);

    task.status = status;
    if (status === 'completed') task.completedAt = new Date();
    await task.save();

    await this.audit(String(task.tenderId), ctx, 'task_updated', `Task ${status}: ${task.title}`, {
      taskId,
    });

    return { id: String(task._id), status: task.status };
  }

  async addComment(
    tenderId: string,
    ctx: RequestContext,
    input: AddFinanceCommentInput
  ): Promise<FinanceWorkflowCommentDto> {
    const request = await FinanceWorkflowRequest.findOne({
      _id: new Types.ObjectId(input.requestId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!request) throw new AppError('Finance request not found', 404);

    const comment = await FinanceComment.create({
      tenderId: new Types.ObjectId(tenderId),
      requestId: request._id,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: ctx.userRole,
      commentType: input.commentType,
      content: input.content,
    });

    await this.audit(tenderId, ctx, 'comment_added', `Comment on ${request.requestNumber}`, {
      requestId: input.requestId,
    });

    return {
      id: String(comment._id),
      tenderId,
      requestId: input.requestId,
      userId: String(comment.userId),
      userName: comment.userName,
      userRole: comment.userRole,
      commentType: comment.commentType,
      content: comment.content,
      createdAt: comment.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  async getComments(requestId: string): Promise<FinanceWorkflowCommentDto[]> {
    const comments = await FinanceComment.find({ requestId: new Types.ObjectId(requestId) })
      .sort({ createdAt: -1 })
      .lean();
    return comments.map((c) => ({
      id: String(c._id),
      tenderId: String(c.tenderId),
      requestId: String(c.requestId),
      userId: String(c.userId),
      userName: c.userName,
      userRole: c.userRole,
      commentType: c.commentType,
      content: c.content,
      createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getApprovals(requestId: string): Promise<FinanceApprovalDto[]> {
    const approvals = await FinanceApproval.find({ requestId: new Types.ObjectId(requestId) })
      .sort({ step: 1 })
      .populate('approverUserId', 'name')
      .lean();
    return approvals.map((a) => ({
      id: String(a._id),
      requestId: String(a.requestId),
      tenderId: String(a.tenderId),
      approverUserId: a.approverUserId ? String(a.approverUserId) : '',
      approverName: (a.approverUserId as { name?: string })?.name,
      approverRole: a.approverRole,
      step: a.step,
      decision: a.decision,
      comments: a.comments,
      decidedAt: a.decidedAt?.toISOString(),
      createdAt: a.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getNotifications(userId: string, limit = 50): Promise<FinanceWorkflowNotificationDto[]> {
    const items = await FinanceWorkflowNotification.find({
      $or: [{ userId: new Types.ObjectId(userId) }, { userId: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return items.map((n) => ({
      id: String(n._id),
      tenderId: n.tenderId ? String(n.tenderId) : undefined,
      userId: n.userId ? String(n.userId) : undefined,
      event: n.event,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: n.entityId ? String(n.entityId) : undefined,
      isRead: n.isRead,
      createdAt: n.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getAuditLogs(query: { tenderId?: string; limit?: number }): Promise<FinanceWorkflowAuditDto[]> {
    const filter: FilterQuery<typeof FinanceWorkflowAuditLog> = {};
    if (query.tenderId) filter.tenderId = new Types.ObjectId(query.tenderId);
    const logs = await FinanceWorkflowAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit || 50)
      .lean();
    return logs.map((l) => ({
      id: String(l._id),
      tenderId: String(l.tenderId),
      userId: String(l.userId),
      userName: l.userName,
      userRole: l.userRole,
      action: l.action,
      message: l.message,
      ipAddress: l.ipAddress,
      metadata: l.metadata,
      createdAt: l.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async processExpiryRenewals(tenderId: string, ctx: RequestContext) {
    const alerts = await FinanceAlert.find({
      tenderId: new Types.ObjectId(tenderId),
      alertLevel: { $in: ['30_days', '15_days', '7_days'] },
    }).lean();

    for (const alert of alerts) {
      const record = await FinanceRecord.findById(alert.financeRecordId);
      if (!record) continue;

      const renewalType = alert.recordType === 'BG' ? 'BG_RENEWAL' : 'PBG_RENEWAL';
      const existing = await FinanceWorkflowRequest.findOne({
        renewalOriginalRecordId: record._id,
        requestType: renewalType,
        status: { $nin: ['rejected', 'completed'] },
      });
      if (existing) continue;

      const newExpiry = new Date(alert.expiryDate);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);

      await this.createRenewalRequest(tenderId, ctx, {
        renewalType,
        financeRecordId: String(record._id),
        newExpiryDate: newExpiry.toISOString().slice(0, 10),
        remarks: `Auto-generated from expiry alert: ${alert.message}`,
        submit: true,
      });

      await this.emitFinanceNotification(
        alert.recordType === 'BG' ? 'bg_expiry_alert' : 'pbg_expiry_alert',
        alert.message,
        `Renewal request created for ${alert.instrumentNumber}.`,
        { tenderId, notifyRole: UserRole.FINANCE }
      );
    }
  }

  async syncOperationalTasks(tenderId: string, ctx: RequestContext) {
    const refunds = await RefundRecord.find({
      tenderId: new Types.ObjectId(tenderId),
      status: { $in: ['pending', 'requested'] },
    });
    for (const refund of refunds) {
      await this.autoCreateTask(tenderId, ctx, {
        taskType: 'follow_up_refund',
        title: `Follow-up refund — ${refund.instrumentLabel}`,
        description: `Refund status: ${refund.status}`,
        relatedRecordId: String(refund.financeRecordId),
      });
      await this.emitFinanceNotification(
        'refund_pending_alert',
        'Refund pending follow-up',
        `${refund.instrumentLabel} refund of ₹${refund.amount.toLocaleString('en-IN')} is pending.`,
        { tenderId, notifyRole: UserRole.FINANCE }
      );
    }

    const ddRecords = await FinanceRecord.find({
      tenderId: new Types.ObjectId(tenderId),
      recordType: 'DD',
      status: 'Issued',
    });
    for (const dd of ddRecords) {
      await this.autoCreateTask(tenderId, ctx, {
        taskType: 'verify_dd',
        title: `Verify DD — ${dd.instrumentNumber || dd.referenceNumber || 'DD'}`,
        relatedRecordId: String(dd._id),
      });
    }
  }
}

export const financeWorkflowService = new FinanceWorkflowService();
