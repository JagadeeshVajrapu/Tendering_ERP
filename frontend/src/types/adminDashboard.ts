export interface AdminTenderOverview {
  totalTenders: number;
  activeTenders: number;
  submittedTenders: number;
  awardedTenders: number;
  lostTenders: number;
  totalTenderValue: number;
  winRatePercent: number;
}

export interface AdminExecutivePerformance {
  executiveId: string;
  executiveName: string;
  email: string;
  assignedTenders: number;
  submittedTenders: number;
  awardedTenders: number;
  winRatePercent: number;
  pendingTasks: number;
}

export interface AdminFinancialOverview {
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

export interface AdminRevenueBilling {
  totalContractValue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  paidInvoices: number;
  unpaidInvoices: number;
  totalInvoices: number;
}

export interface AdminContractOverview {
  runningContracts: number;
  completedContracts: number;
  contractsExpiringSoon: number;
  amcExpiringSoon: number;
  agreementsExpiringSoon: number;
}

export interface AdminCriticalAlert {
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

export interface AdminRecentActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  module: string;
  tenderId?: string;
}

export interface AdminDashboard {
  tenderOverview: AdminTenderOverview;
  executivePerformance: AdminExecutivePerformance[];
  financialOverview: AdminFinancialOverview;
  revenueBilling: AdminRevenueBilling;
  contractOverview: AdminContractOverview;
  criticalAlerts: AdminCriticalAlert[];
  recentActivity: AdminRecentActivity[];
  generatedAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
}
