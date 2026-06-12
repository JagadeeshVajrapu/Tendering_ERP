export interface PostAwardSummary {
  totalAwardedContracts: number;
  activeContracts: number;
  contractsExpiringSoon: number;
  amcExpiringSoon: number;
  totalRevenue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
}

export interface PostAwardContract {
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
  status: string;
  renewalStatus: string;
  totalRevenue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  activatedAt: string;
  awardedAt?: string;
  createdAt: string;
}

export interface PostAwardRevenue {
  id: string;
  description: string;
  amount: number;
  dueDate?: string;
  receivedAmount: number;
  status: string;
  approvalStatus: string;
  createdAt: string;
}

export interface PostAwardBilling {
  id: string;
  invoiceNumber?: string;
  description: string;
  amount: number;
  billingDate?: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
}

export interface PostAwardDocument {
  id: string;
  documentType: string;
  originalName: string;
  documentNumber?: string;
  uploadedAt: string;
}

export interface PostAwardAlert {
  id: string;
  contractId: string;
  tenderId: string;
  alertType: string;
  priority: string;
  title: string;
  message: string;
  dueDate?: string;
  createdAt: string;
}

export interface PostAwardLogEntry {
  id: string;
  userName: string;
  action: string;
  message: string;
  createdAt: string;
}

export interface PostAwardContractDetail extends PostAwardContract {
  revenue: PostAwardRevenue[];
  billing: PostAwardBilling[];
  documents: PostAwardDocument[];
  activityLog: PostAwardLogEntry[];
}

export interface PostAwardDashboard {
  summary: PostAwardSummary;
  contracts: {
    items: PostAwardContract[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  alerts: PostAwardAlert[];
  recentActivity: PostAwardLogEntry[];
}
