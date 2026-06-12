import { Types } from 'mongoose';
import { Tender } from '../../models/Tender';
import { Approval } from '../../models/Approval';
import { FinanceRequest } from '../../models/FinanceRequest';
import { ApprovalDecision, FinanceRequestStatus } from '../../types';
import { ComplianceRequest, ComplianceStatus } from '../../models/ComplianceRequest';
import { TenderStatus, ApprovalType, UserRole, NotificationType, FinanceRequestType } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { notificationService } from '../notification/notificationService';
import { auditService } from '../audit/auditService';

class WorkflowService {
  async updateTenderStatus(
    tenderId: string,
    status: TenderStatus,
    userId: Types.ObjectId,
    userRole: UserRole,
    metadata?: Record<string, unknown>
  ) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);
    const oldStatus = tender.status;
    tender.status = status;
    tender.currentStage = this.getStageLabel(status);
    if (metadata) tender.metadata = { ...tender.metadata, ...metadata };
    await tender.save();

    await auditService.log({
      userId,
      userRole,
      action: 'TENDER_STATUS_CHANGE',
      entityType: 'Tender',
      entityId: tenderId,
      oldValue: { status: oldStatus },
      newValue: { status },
    });

    return tender;
  }

  async submitToMd(tenderId: string, userId: Types.ObjectId, userRole: UserRole, summaryId: string) {
    const tender = await this.updateTenderStatus(tenderId, TenderStatus.PENDING_MD_APPROVAL, userId, userRole);
    await Approval.create({
      tenderId,
      type: ApprovalType.MD,
      requestedBy: userId,
      summaryId,
      decision: ApprovalDecision.PENDING,
    });
    await notificationService.notifyRole(
      UserRole.MD,
      NotificationType.APPROVAL_REQUEST,
      'New Tender Approval Required',
      `Tender "${tender.title}" requires MD approval.`,
      'Tender',
      tenderId
    );
    return tender;
  }

  async mdDecision(
    tenderId: string,
    approved: boolean,
    reviewerId: Types.ObjectId,
    userRole: UserRole,
    comments?: string
  ) {
    const approval = await Approval.findOne({
      tenderId,
      type: ApprovalType.MD,
      decision: ApprovalDecision.PENDING,
    }).sort({ createdAt: -1 });
    if (!approval) throw new AppError('No pending MD approval found', 404);

    const status = approved ? TenderStatus.APPROVED_BY_MD : TenderStatus.REJECTED_BY_MD;
    const tender = await this.updateTenderStatus(tenderId, status, reviewerId, userRole);

    approval.decision = approved ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED;
    approval.reviewedBy = reviewerId;
    approval.comments = comments;
    approval.decidedAt = new Date();
    await approval.save();

    const executiveId = tender.createdBy;
    await notificationService.notifyUser(
      executiveId,
      NotificationType.TENDER_STATUS,
      approved ? 'Tender Approved by MD' : 'Tender Rejected by MD',
      `Tender "${tender.title}" has been ${approved ? 'approved' : 'rejected'} by Managing Director.`,
      'Tender',
      tenderId
    );

    if (ioEmit) ioEmit(tenderId, { status, tender });
    return { tender, approval };
  }

  async createFinanceRequest(
    tenderId: string,
    userId: Types.ObjectId,
    requestType: FinanceRequestType,
    amount: number
  ) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const request = await FinanceRequest.create({
      tenderId,
      requestedBy: userId,
      requestType,
      amount,
      status: FinanceRequestStatus.PENDING,
    });

    await this.updateTenderStatus(tenderId, TenderStatus.FINANCE_PENDING, userId, UserRole.EXECUTIVE);

    await notificationService.notifyRole(
      UserRole.FINANCE,
      NotificationType.FINANCE_REQUEST,
      `New ${requestType} Request`,
      `Finance request for Rs. ${amount} on tender "${tender.title}".`,
      'FinanceRequest',
      request._id
    );
    return request;
  }

  async financeDecision(
    requestId: string,
    approved: boolean,
    reviewerId: Types.ObjectId,
    userRole: UserRole,
    comments?: string
  ) {
    const request = await FinanceRequest.findById(requestId);
    if (!request) throw new AppError('Finance request not found', 404);

    request.status = approved ? FinanceRequestStatus.APPROVED : FinanceRequestStatus.REJECTED;
    request[approved ? 'approvedBy' : 'rejectedBy'] = reviewerId;
    request.comments = comments;
    request.decidedAt = new Date();
    await request.save();

    const status = approved ? TenderStatus.FINANCE_APPROVED : TenderStatus.FINANCE_REJECTED;
    const tender = await this.updateTenderStatus(String(request.tenderId), status, reviewerId, userRole);

    await notificationService.notifyUser(
      request.requestedBy,
      NotificationType.FINANCE_REQUEST,
      approved ? 'Finance Request Approved' : 'Finance Request Rejected',
      `Your ${request.requestType} request has been ${approved ? 'approved' : 'rejected'}.`,
      'FinanceRequest',
      requestId
    );

    if (ioEmit) ioEmit(String(request.tenderId), { status, tender });
    return { request, tender };
  }

  async createComplianceRequest(tenderId: string, userId: Types.ObjectId, documentTypes: string[]) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const request = await ComplianceRequest.create({
      tenderId,
      requestedBy: userId,
      documentTypes,
      status: ComplianceStatus.PENDING,
      documentIds: [],
    });

    await this.updateTenderStatus(tenderId, TenderStatus.MANAGER_PENDING, userId, UserRole.EXECUTIVE);

    await notificationService.notifyRole(
      UserRole.MANAGER,
      NotificationType.COMPLIANCE_REQUEST,
      'Compliance Documents Required',
      `Compliance documents needed for tender "${tender.title}".`,
      'ComplianceRequest',
      request._id
    );
    return request;
  }

  async approveCompliance(requestId: string, reviewerId: Types.ObjectId, userRole: UserRole) {
    const request = await ComplianceRequest.findById(requestId);
    if (!request) throw new AppError('Compliance request not found', 404);

    request.status = ComplianceStatus.APPROVED;
    request.approvedBy = reviewerId;
    request.decidedAt = new Date();
    await request.save();

    const tender = await this.updateTenderStatus(
      String(request.tenderId),
      TenderStatus.MANAGER_APPROVED,
      reviewerId,
      userRole
    );

    const allFinanceDone = await this.checkReadyForBid(String(request.tenderId));
    if (allFinanceDone) {
      await this.updateTenderStatus(String(request.tenderId), TenderStatus.READY_FOR_BID, reviewerId, userRole);
    }

    await notificationService.notifyUser(
      request.requestedBy,
      NotificationType.COMPLIANCE_REQUEST,
      'Compliance Approved',
      'Compliance documents have been approved.',
      'ComplianceRequest',
      requestId
    );

    if (ioEmit) ioEmit(String(request.tenderId), { status: tender.status, tender });
    return { request, tender };
  }

  private async checkReadyForBid(tenderId: string): Promise<boolean> {
    const tender = await Tender.findById(tenderId);
    if (!tender) return false;
    const approvedFinance = await FinanceRequest.countDocuments({
      tenderId,
      status: FinanceRequestStatus.APPROVED,
    });
    return (
      tender.status === TenderStatus.MANAGER_APPROVED ||
      (tender.status === TenderStatus.FINANCE_APPROVED && approvedFinance > 0)
    );
  }

  private getStageLabel(status: TenderStatus): string {
    const labels: Record<TenderStatus, string> = {
      [TenderStatus.DRAFT]: 'Draft',
      [TenderStatus.NIT_ANALYZED]: 'Analysis Completed',
      [TenderStatus.SUMMARY_GENERATED]: 'Report Generated',
      [TenderStatus.PENDING_MD_APPROVAL]: 'Pending MD Approval',
      [TenderStatus.APPROVED_BY_MD]: 'Approved by MD',
      [TenderStatus.REJECTED_BY_MD]: 'Rejected by MD',
      [TenderStatus.FINANCE_PENDING]: 'Finance Pending',
      [TenderStatus.FINANCE_APPROVED]: 'Finance Approved',
      [TenderStatus.FINANCE_REJECTED]: 'Finance Rejected',
      [TenderStatus.MANAGER_PENDING]: 'Compliance Pending',
      [TenderStatus.MANAGER_APPROVED]: 'Compliance Approved',
      [TenderStatus.READY_FOR_BID]: 'Ready for Bid',
      [TenderStatus.SUBMITTED]: 'Submitted',
      [TenderStatus.AWARDED]: 'Awarded',
    };
    return labels[status] || status;
  }
}

let ioEmit: ((tenderId: string, data: unknown) => void) | null = null;

export function setWorkflowIoEmitter(emitter: (tenderId: string, data: unknown) => void): void {
  ioEmit = emitter;
}

export function getWorkflowIoEmitter(): ((tenderId: string, data: unknown) => void) | null {
  return ioEmit;
}

export const workflowService = new WorkflowService();
