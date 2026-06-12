export type FinanceRecordType =
  | 'EMD'
  | 'BG'
  | 'DD'
  | 'TENDER_FEE'
  | 'SECURITY_DEPOSIT'
  | 'PBG';

export type RefundStatus = 'pending' | 'requested' | 'approved' | 'received';

export type BgPbgStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Released';

export type DdStatus = 'Issued' | 'Submitted' | 'Cleared';

export type TenderFeeStatus = 'Paid' | 'Pending';

export type SecurityDepositStatus = 'Active' | 'Refund Pending' | 'Refunded';

export type FinanceDocumentType =
  | 'EMD_RECEIPT'
  | 'BG_COPY'
  | 'DD_COPY'
  | 'TENDER_FEE_RECEIPT'
  | 'SECURITY_DEPOSIT_RECEIPT'
  | 'PBG_COPY';

export type FinanceAlertLevel = '30_days' | '15_days' | '7_days' | 'expired';

export interface FinanceSummaryDto {
  emdAmount: number;
  bgAmount: number;
  ddAmount: number;
  tenderFeeAmount: number;
  securityDepositAmount: number;
  pbgAmount: number;
  pendingRefundAmount: number;
  totalCommitted: number;
}

export type FinancialRequirementStatus =
  | 'not_required'
  | 'pending'
  | 'partial'
  | 'complete'
  | 'overpaid'
  | 'informational';

export interface TenderFinancialRequirementDto {
  label: string;
  recordType?: FinanceRecordType;
  requiredAmount?: number;
  requiredDisplay?: string;
  trackedAmount: number;
  remainingAmount: number;
  status: FinancialRequirementStatus;
}

export interface TenderFinancialContextDto {
  estimatedBidValue?: number;
  estimatedBidValueDisplay?: string;
  requiredEmd?: number;
  requiredEmdDisplay?: string;
  tenderFee?: number;
  tenderFeeDisplay?: string;
  performanceSecurityDisplay?: string;
  bidSubmissionDeadline?: string;
  source: 'nit_analysis' | 'tender_record' | 'none';
  requirements: TenderFinancialRequirementDto[];
  totalRequired: number;
  totalTracked: number;
  totalRemaining: number;
}

export interface FinanceRecordDto {
  id: string;
  tenderId: string;
  recordType: FinanceRecordType;
  amount: number;
  bankName?: string;
  referenceNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  status: string;
  remarks?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  paymentDate?: string;
  paymentMode?: string;
  transactionReferenceNumber?: string;
  refundStatus?: RefundStatus;
  instrumentNumber?: string;
  depositDate?: string;
}

export interface RefundRecordDto {
  id: string;
  tenderId: string;
  financeRecordId: string;
  instrumentType: FinanceRecordType;
  instrumentLabel: string;
  amount: number;
  status: RefundStatus;
  requestDate?: string;
  approvalDate?: string;
  receivedDate?: string;
  pendingSince?: string;
  history: Array<{
    status: RefundStatus;
    date: string;
    updatedByName?: string;
    note?: string;
  }>;
}

export interface FinanceAlertDto {
  id: string;
  tenderId: string;
  financeRecordId: string;
  recordType: 'BG' | 'PBG';
  instrumentNumber: string;
  alertLevel: FinanceAlertLevel;
  message: string;
  daysUntilExpiry: number;
  expiryDate: string;
  createdAt: string;
}

export interface FinanceDocumentDto {
  id: string;
  tenderId: string;
  financeRecordId?: string;
  documentType: FinanceDocumentType;
  fileName: string;
  originalName: string;
  mimeType: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
}

export interface FinanceLogDto {
  id: string;
  tenderId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RefundReportItemDto {
  tenderId: string;
  tenderName: string;
  instrumentType: FinanceRecordType;
  instrumentLabel: string;
  amount: number;
  pendingSince: string;
  currentStatus: RefundStatus;
}

export interface FinanceDashboardDto {
  tenderId: string;
  tenderName: string;
  financialContext: TenderFinancialContextDto;
  summary: FinanceSummaryDto;
  records: {
    items: FinanceRecordDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  refunds: RefundRecordDto[];
  refundReport: {
    items: RefundReportItemDto[];
    totalPendingAmount: number;
  };
  alerts: FinanceAlertDto[];
  documents: FinanceDocumentDto[];
  activityLog: FinanceLogDto[];
}

export interface CreateFinanceRecordInput {
  recordType: FinanceRecordType;
  amount: number;
  bankName?: string;
  referenceNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
  remarks?: string;
  paymentDate?: string;
  paymentMode?: string;
  transactionReferenceNumber?: string;
  instrumentNumber?: string;
  depositDate?: string;
}

export interface UpdateFinanceRecordInput extends Partial<CreateFinanceRecordInput> {}

export interface UpdateRefundStatusInput {
  refundRecordId?: string;
  financeRecordId?: string;
  status: RefundStatus;
  note?: string;
  requestDate?: string;
  approvalDate?: string;
  receivedDate?: string;
}

export interface FinanceRecordListQuery {
  page?: number;
  limit?: number;
  search?: string;
  recordType?: FinanceRecordType;
  status?: string;
  sortBy?: 'amount' | 'createdAt' | 'issueDate' | 'expiryDate';
  sortOrder?: 'asc' | 'desc';
}
