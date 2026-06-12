export type FinanceWorkflowRequestType =
  | 'EMD_REQUEST'
  | 'BG_REQUEST'
  | 'DD_REQUEST'
  | 'TENDER_FEE_PAYMENT'
  | 'SECURITY_DEPOSIT_PAYMENT'
  | 'PBG_REQUEST'
  | 'REFUND_EMD'
  | 'REFUND_SECURITY_DEPOSIT'
  | 'PBG_RELEASE'
  | 'BG_RENEWAL'
  | 'PBG_RENEWAL';

export type FinanceWorkflowStatus =
  | 'draft'
  | 'submitted'
  | 'pending_finance'
  | 'pending_manager'
  | 'approved'
  | 'rejected'
  | 'completed';

export type FinanceTaskStatus = 'pending' | 'in_progress' | 'completed';

export type FinanceTaskType =
  | 'follow_up_refund'
  | 'renew_bg'
  | 'renew_pbg'
  | 'verify_dd'
  | 'general';

export type FinanceCommentType = 'internal_note' | 'finance_remark' | 'approval_comment';

export type FinanceNotificationEvent =
  | 'approval_request'
  | 'refund_submitted'
  | 'approval_completed'
  | 'approval_rejected'
  | 'bg_expiry_alert'
  | 'pbg_expiry_alert'
  | 'refund_pending_alert';

export interface FinanceWorkflowRequestDto {
  id: string;
  requestNumber: string;
  tenderId: string;
  tenderName?: string;
  requestType: FinanceWorkflowRequestType;
  amount: number;
  requestedBy: string;
  requestedByName?: string;
  status: FinanceWorkflowStatus;
  displayStatus: string;
  currentApproverRole?: string;
  approvalStep: number;
  approvalDate?: string;
  rejectionReason?: string;
  remarks?: string;
  financeRecordId?: string;
  refundRecordId?: string;
  renewalOriginalRecordId?: string;
  renewalDate?: string;
  newExpiryDate?: string;
  renewalStatus?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinanceApprovalDto {
  id: string;
  requestId: string;
  tenderId: string;
  approverUserId: string;
  approverName?: string;
  approverRole: string;
  step: number;
  decision: 'pending' | 'approved' | 'rejected';
  comments?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface FinanceTaskDto {
  id: string;
  tenderId: string;
  tenderName?: string;
  taskType: FinanceTaskType;
  title: string;
  description?: string;
  status: FinanceTaskStatus;
  assignedTo?: string;
  assignedToName?: string;
  relatedRequestId?: string;
  relatedRecordId?: string;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

export interface FinanceWorkflowNotificationDto {
  id: string;
  tenderId?: string;
  userId?: string;
  event: FinanceNotificationEvent;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface FinanceWorkflowCommentDto {
  id: string;
  tenderId: string;
  requestId: string;
  userId: string;
  userName: string;
  userRole: string;
  commentType: FinanceCommentType;
  content: string;
  createdAt: string;
}

export interface FinanceWorkflowAuditDto {
  id: string;
  tenderId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  message: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface FinanceApprovalDashboardDto {
  widgets: {
    totalPendingApprovals: number;
    totalApprovedRequests: number;
    totalPendingRefunds: number;
    bgExpiringSoon: number;
    pbgExpiringSoon: number;
    totalFinanceTasks: number;
  };
  pendingApprovals: FinanceWorkflowRequestDto[];
  approvedRequests: FinanceWorkflowRequestDto[];
  rejectedRequests: FinanceWorkflowRequestDto[];
  completedRequests: FinanceWorkflowRequestDto[];
  refundRequests: FinanceWorkflowRequestDto[];
  bgRenewals: FinanceWorkflowRequestDto[];
  pbgRenewals: FinanceWorkflowRequestDto[];
  tasks: FinanceTaskDto[];
  notifications: FinanceWorkflowNotificationDto[];
  auditLogs: FinanceWorkflowAuditDto[];
}

export interface CreateFinanceWorkflowRequestInput {
  requestType: FinanceWorkflowRequestType;
  amount: number;
  remarks?: string;
  financeRecordId?: string;
  refundRecordId?: string;
  submit?: boolean;
}

export interface CreateRefundWorkflowInput {
  refundType: 'REFUND_EMD' | 'REFUND_SECURITY_DEPOSIT' | 'PBG_RELEASE';
  amount: number;
  remarks?: string;
  refundRecordId?: string;
  financeRecordId?: string;
  submit?: boolean;
}

export interface CreateRenewalRequestInput {
  renewalType: 'BG_RENEWAL' | 'PBG_RENEWAL';
  financeRecordId: string;
  renewalDate?: string;
  newExpiryDate?: string;
  amount?: number;
  remarks?: string;
  submit?: boolean;
}

export interface ApproveRejectInput {
  comments?: string;
  rejectionReason?: string;
}

export interface CreateFinanceTaskInput {
  taskType: FinanceTaskType;
  title: string;
  description?: string;
  assignedTo?: string;
  relatedRequestId?: string;
  relatedRecordId?: string;
  dueDate?: string;
}

export interface AddFinanceCommentInput {
  requestId: string;
  commentType: FinanceCommentType;
  content: string;
}

export interface FinanceWorkflowListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: FinanceWorkflowStatus | 'pending' | 'completed';
  requestType?: FinanceWorkflowRequestType;
  tenderId?: string;
  sortBy?: 'createdAt' | 'amount' | 'requestNumber';
  sortOrder?: 'asc' | 'desc';
}
