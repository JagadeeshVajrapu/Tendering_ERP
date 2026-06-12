export type PostAwardContractStatus = 'active' | 'expiring_soon' | 'expired' | 'completed';

export type PostAwardDocumentType = 'work_order' | 'agreement' | 'purchase_order';

export type PostAwardRevenueStatus = 'pending' | 'partial' | 'received' | 'overdue';

export type PostAwardBillingStatus = 'draft' | 'pending' | 'approved' | 'invoiced' | 'paid';

export type PostAwardAlertType =
  | 'contract_expiry'
  | 'amc_expiry'
  | 'agreement_expiry'
  | 'revenue_delay'
  | 'pending_billing';

export type PostAwardAlertPriority = 'critical' | 'high' | 'medium' | 'low';

export type PostAwardRenewalStatus = 'active' | 'expiring_soon' | 'renewal_pending' | 'renewed' | 'expired';

export interface PostAwardSummaryDto {
  totalAwardedContracts: number;
  activeContracts: number;
  contractsExpiringSoon: number;
  amcExpiringSoon: number;
  totalRevenue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
}

export interface PostAwardContractDto {
  id: string;
  tenderId: string;
  clientName: string;
  tenderNumber?: string;
  tenderTitle: string;
  workOrderNumber?: string;
  agreementNumber?: string;
  purchaseOrderNumber?: string;
  contractValue: number;
  contractStartDate?: string;
  contractEndDate?: string;
  amcStartDate?: string;
  amcEndDate?: string;
  agreementExpiryDate?: string;
  status: PostAwardContractStatus;
  renewalStatus: PostAwardRenewalStatus;
  totalRevenue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  activatedAt: string;
  awardedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PostAwardRevenueDto {
  id: string;
  contractId: string;
  tenderId: string;
  description: string;
  amount: number;
  dueDate?: string;
  receivedDate?: string;
  receivedAmount: number;
  status: PostAwardRevenueStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface PostAwardBillingDto {
  id: string;
  contractId: string;
  tenderId: string;
  invoiceNumber?: string;
  description: string;
  amount: number;
  billingDate?: string;
  status: PostAwardBillingStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface PostAwardDocumentDto {
  id: string;
  contractId: string;
  tenderId: string;
  documentType: PostAwardDocumentType;
  fileName: string;
  originalName: string;
  mimeType: string;
  documentNumber?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
}

export interface PostAwardAlertDto {
  id: string;
  contractId: string;
  tenderId: string;
  alertType: PostAwardAlertType;
  priority: PostAwardAlertPriority;
  title: string;
  message: string;
  dueDate?: string;
  isDismissed: boolean;
  createdAt: string;
}

export interface PostAwardLogDto {
  id: string;
  tenderId: string;
  contractId?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  message: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  createdAt: string;
}

export interface PostAwardDashboardDto {
  summary: PostAwardSummaryDto;
  contracts: {
    items: PostAwardContractDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  alerts: PostAwardAlertDto[];
  recentActivity: PostAwardLogDto[];
}

export interface PostAwardContractDetailDto extends PostAwardContractDto {
  revenue: PostAwardRevenueDto[];
  billing: PostAwardBillingDto[];
  documents: PostAwardDocumentDto[];
  activityLog: PostAwardLogDto[];
}

export interface PostAwardSearchQuery {
  q?: string;
  match?: 'partial' | 'exact';
  status?: PostAwardContractStatus;
  clientName?: string;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
  sortBy?: 'awardedAt' | 'contractEndDate' | 'clientName' | 'totalRevenue';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateRevenueInput {
  description: string;
  amount: number;
  dueDate?: string;
}

export interface CreateBillingInput {
  description: string;
  amount: number;
  invoiceNumber?: string;
  billingDate?: string;
}

export interface UpdateContractInput {
  clientName?: string;
  workOrderNumber?: string;
  agreementNumber?: string;
  purchaseOrderNumber?: string;
  contractValue?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  amcStartDate?: string;
  amcEndDate?: string;
  agreementExpiryDate?: string;
}
