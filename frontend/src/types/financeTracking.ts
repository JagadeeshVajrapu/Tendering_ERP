export type FinanceRecordType =
  | 'EMD'
  | 'BG'
  | 'DD'
  | 'TENDER_FEE'
  | 'SECURITY_DEPOSIT'
  | 'PBG';

export type RefundStatus = 'pending' | 'requested' | 'approved' | 'received';

export type FinanceDocumentType =
  | 'EMD_RECEIPT'
  | 'BG_COPY'
  | 'DD_COPY'
  | 'TENDER_FEE_RECEIPT'
  | 'SECURITY_DEPOSIT_RECEIPT'
  | 'PBG_COPY';

export type FinanceAlertLevel = '30_days' | '15_days' | '7_days' | 'expired';

export interface FinanceSummary {
  emdAmount: number;
  bgAmount: number;
  ddAmount: number;
  tenderFeeAmount: number;
  securityDepositAmount: number;
  pbgAmount: number;
  pendingRefundAmount: number;
}

export interface FinanceRecord {
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

export interface RefundRecord {
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

export interface FinanceAlert {
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

export interface FinanceDocument {
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

export interface FinanceLogEntry {
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

export interface RefundReportItem {
  tenderId: string;
  tenderName: string;
  instrumentType: FinanceRecordType;
  instrumentLabel: string;
  amount: number;
  pendingSince: string;
  currentStatus: RefundStatus;
}

export interface FinanceDashboard {
  tenderId: string;
  tenderName: string;
  summary: FinanceSummary;
  records: {
    items: FinanceRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  refunds: RefundRecord[];
  refundReport: {
    items: RefundReportItem[];
    totalPendingAmount: number;
  };
  alerts: FinanceAlert[];
  documents: FinanceDocument[];
  activityLog: FinanceLogEntry[];
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

export const RECORD_TYPE_LABELS: Record<FinanceRecordType, string> = {
  EMD: 'EMD (Earnest Money Deposit)',
  BG: 'BG (Bank Guarantee)',
  DD: 'DD (Demand Draft)',
  TENDER_FEE: 'Tender Fee',
  SECURITY_DEPOSIT: 'Security Deposit',
  PBG: 'PBG (Performance Bank Guarantee)',
};

export const DOCUMENT_TYPE_LABELS: Record<FinanceDocumentType, string> = {
  EMD_RECEIPT: 'EMD Receipt',
  BG_COPY: 'BG Copy',
  DD_COPY: 'DD Copy',
  TENDER_FEE_RECEIPT: 'Tender Fee Receipt',
  SECURITY_DEPOSIT_RECEIPT: 'Security Deposit Receipt',
  PBG_COPY: 'PBG Copy',
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: 'Pending',
  requested: 'Requested',
  approved: 'Approved',
  received: 'Received',
};
