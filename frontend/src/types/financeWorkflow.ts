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

export interface FinanceWorkflowRequest {
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

export interface FinanceTask {
  id: string;
  tenderId: string;
  tenderName?: string;
  taskType: string;
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

export interface FinanceWorkflowNotification {
  id: string;
  tenderId?: string;
  event: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface FinanceWorkflowAuditEntry {
  id: string;
  tenderId: string;
  userName: string;
  userRole: string;
  action: string;
  message: string;
  createdAt: string;
}

export interface FinanceWorkflowComment {
  id: string;
  requestId: string;
  userName: string;
  userRole: string;
  commentType: string;
  content: string;
  createdAt: string;
}

export interface FinanceApprovalDashboard {
  widgets: {
    totalPendingApprovals: number;
    totalApprovedRequests: number;
    totalPendingRefunds: number;
    bgExpiringSoon: number;
    pbgExpiringSoon: number;
    totalFinanceTasks: number;
  };
  pendingApprovals: FinanceWorkflowRequest[];
  approvedRequests: FinanceWorkflowRequest[];
  rejectedRequests: FinanceWorkflowRequest[];
  completedRequests: FinanceWorkflowRequest[];
  refundRequests: FinanceWorkflowRequest[];
  bgRenewals: FinanceWorkflowRequest[];
  pbgRenewals: FinanceWorkflowRequest[];
  tasks: FinanceTask[];
  notifications: FinanceWorkflowNotification[];
  auditLogs: FinanceWorkflowAuditEntry[];
}

export const REQUEST_TYPE_LABELS: Record<FinanceWorkflowRequestType, string> = {
  EMD_REQUEST: 'EMD Request',
  BG_REQUEST: 'BG Request',
  DD_REQUEST: 'DD Request',
  TENDER_FEE_PAYMENT: 'Tender Fee Payment',
  SECURITY_DEPOSIT_PAYMENT: 'Security Deposit Payment',
  PBG_REQUEST: 'PBG Request',
  REFUND_EMD: 'EMD Refund',
  REFUND_SECURITY_DEPOSIT: 'Security Deposit Refund',
  PBG_RELEASE: 'PBG Release',
  BG_RENEWAL: 'BG Renewal',
  PBG_RENEWAL: 'PBG Renewal',
};
