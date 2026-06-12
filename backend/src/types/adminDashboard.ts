export interface AdminTenderOverviewDto {
  totalTenders: number;
  activeTenders: number;
  submittedTenders: number;
  awardedTenders: number;
  lostTenders: number;
  totalTenderValue: number;
  winRatePercent: number;
}

export interface AdminExecutivePerformanceDto {
  executiveId: string;
  executiveName: string;
  email: string;
  assignedTenders: number;
  submittedTenders: number;
  awardedTenders: number;
  winRatePercent: number;
  pendingTasks: number;
}

export interface AdminFinancialOverviewDto {
  emdLocked: number;
  emdRefunded: number;
  pendingRefundAmount: number;
  activeBg: number;
  pendingBg: number;
  expiredBg: number;
  tenderFeesPaid: number;
  securityDeposits: number;
  pbgActive: number;
  pbgExpired: number;
  pbgPending: number;
}

export interface AdminRevenueBillingDto {
  totalContractValue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalInvoices: number;
}

export interface AdminContractOverviewDto {
  runningContracts: number;
  completedContracts: number;
  contractsExpiringSoon: number;
  amcExpiringSoon: number;
  agreementsExpiringSoon: number;
}

export interface AdminCriticalAlertDto {
  id: string;
  alertType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  module: string;
  tenderId?: string;
  contractId?: string;
  dueDate?: string;
}

export interface AdminRecentActivityDto {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  module: string;
  tenderId?: string;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
}

export interface AdminDashboardDto {
  tenderOverview: AdminTenderOverviewDto;
  executivePerformance: AdminExecutivePerformanceDto[];
  financialOverview: AdminFinancialOverviewDto;
  revenueBilling: AdminRevenueBillingDto;
  contractOverview: AdminContractOverviewDto;
  criticalAlerts: AdminCriticalAlertDto[];
  recentActivity: AdminRecentActivityDto[];
  generatedAt: string;
}
