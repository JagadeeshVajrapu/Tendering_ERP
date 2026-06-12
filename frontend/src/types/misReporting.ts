export type MisAlertPriority = 'critical' | 'high' | 'medium' | 'low';

export interface MisFilterQuery {
  dateFrom?: string;
  dateTo?: string;
  serviceCategory?: string;
  clientName?: string;
  tenderStatus?: string;
  contractStatus?: string;
}

export interface MisExecutiveSummary {
  participatedTenders: number;
  wonTenders: number;
  lostTenders: number;
  winRate: number;
  tenderValue: number;
  runningContracts: number;
  expiredContracts: number;
  expiringContracts: number;
  emdLocked: number;
  pendingBg: number;
  revenueReceived: number;
  pendingRevenue: number;
  pendingBilling: number;
}

export interface MisTenderPerformance {
  totalParticipated: number;
  totalWon: number;
  totalLost: number;
  winRatePercent: number;
}

export interface MisTenderValue {
  totalTenderValue: number;
  awardedTenderValue: number;
  lostTenderValue: number;
}

export interface MisServiceCategoryItem {
  category: string;
  count: number;
}

export interface MisServiceCategory {
  categories: MisServiceCategoryItem[];
  total: number;
}

export interface MisFinanceSummary {
  emdLocked: number;
  emdRefunded: number;
  pendingRefund: number;
  receivedBg: number;
  pendingBg: number;
  activeBg: number;
}

export interface MisContracts {
  runningContracts: number;
  completedContracts: number;
  expiredContracts: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
}

export interface MisRevenue {
  contractValue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
}

export interface MisAlert {
  id: string;
  alertType: string;
  priority: MisAlertPriority;
  title: string;
  message: string;
  tenderId?: string;
  contractId?: string;
  dueDate?: string;
  module: string;
}

export interface MisAlerts {
  critical: MisAlert[];
  high: MisAlert[];
  medium: MisAlert[];
  low: MisAlert[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface MisSearchResult {
  id: string;
  type: 'tender' | 'contract';
  tenderId: string;
  tenderNumber?: string;
  tenderName: string;
  clientName?: string;
  workOrderNumber?: string;
  agreementNumber?: string;
  contractNumber?: string;
  status?: string;
}

export interface MisRecentActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  module: string;
  tenderId?: string;
  contractId?: string;
}

export interface MisQuickInsight {
  key: string;
  label: string;
  value: string;
  detail?: string;
}

export interface MisDashboard {
  summary: MisExecutiveSummary;
  tenderPerformance: MisTenderPerformance;
  tenderValue: MisTenderValue;
  serviceCategory: MisServiceCategory;
  finance: MisFinanceSummary;
  contracts: MisContracts;
  revenue: MisRevenue;
  alerts: MisAlerts;
  quickInsights: MisQuickInsight[];
  filters: MisFilterQuery;
  generatedAt: string;
  permissions: {
    canViewFinance: boolean;
    canViewContracts: boolean;
    canViewAll: boolean;
    canExport: boolean;
  };
}
