import { TenderStatus } from './index';
import { PostAwardContractStatus } from './postAward';

export type MisAlertPriority = 'critical' | 'high' | 'medium' | 'low';

export type MisAlertType =
  | 'contract_expiry'
  | 'amc_expiry'
  | 'bg_expiry'
  | 'pbg_expiry'
  | 'agreement_expiry'
  | 'pending_refund'
  | 'pending_billing'
  | 'revenue_delay';

export type MisExportFormat = 'excel' | 'pdf' | 'csv';

export interface MisFilterQuery {
  dateFrom?: string;
  dateTo?: string;
  serviceCategory?: string;
  clientName?: string;
  tenderStatus?: TenderStatus;
  contractStatus?: PostAwardContractStatus;
}

export interface MisExecutiveSummaryDto {
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

export interface MisTenderPerformanceDto {
  totalParticipated: number;
  totalWon: number;
  totalLost: number;
  winRatePercent: number;
}

export interface MisTenderValueDto {
  totalTenderValue: number;
  awardedTenderValue: number;
  lostTenderValue: number;
}

export interface MisServiceCategoryItemDto {
  category: string;
  count: number;
}

export interface MisServiceCategoryDto {
  categories: MisServiceCategoryItemDto[];
  total: number;
}

export interface MisFinanceSummaryDto {
  emdLocked: number;
  emdRefunded: number;
  pendingRefund: number;
  receivedBg: number;
  pendingBg: number;
  activeBg: number;
}

export interface MisContractsDto {
  runningContracts: number;
  completedContracts: number;
  expiredContracts: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
}

export interface MisRevenueDto {
  contractValue: number;
  revenueReceived: number;
  revenuePending: number;
  pendingBilling: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
}

export interface MisAlertDto {
  id: string;
  alertType: MisAlertType;
  priority: MisAlertPriority;
  title: string;
  message: string;
  tenderId?: string;
  contractId?: string;
  dueDate?: string;
  module: string;
}

export interface MisAlertsDto {
  critical: MisAlertDto[];
  high: MisAlertDto[];
  medium: MisAlertDto[];
  low: MisAlertDto[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface MisSearchResultDto {
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

export interface MisRecentActivityDto {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  module: string;
  tenderId?: string;
  contractId?: string;
}

export interface MisQuickInsightDto {
  key: string;
  label: string;
  value: string;
  detail?: string;
}

export interface MisDashboardDto {
  summary: MisExecutiveSummaryDto;
  tenderPerformance: MisTenderPerformanceDto;
  tenderValue: MisTenderValueDto;
  serviceCategory: MisServiceCategoryDto;
  finance: MisFinanceSummaryDto;
  contracts: MisContractsDto;
  revenue: MisRevenueDto;
  alerts: MisAlertsDto;
  quickInsights: MisQuickInsightDto[];
  filters: MisFilterQuery;
  generatedAt: string;
  permissions: {
    canViewFinance: boolean;
    canViewContracts: boolean;
    canViewAll: boolean;
    canExport: boolean;
  };
}

export interface MisExportDescriptor {
  format: MisExportFormat;
  section: string;
  label: string;
  enabled: boolean;
}
