import crypto from 'crypto';
import { FilterQuery, Types } from 'mongoose';
import { Tender, ITender } from '../../models/Tender';
import { TenderServiceClassification } from '../../models/TenderServiceClassification';
import { FinanceRecord } from '../../models/FinanceRecord';
import { RefundRecord } from '../../models/RefundRecord';
import { FinanceAlert } from '../../models/FinanceAlert';
import { FinanceLog } from '../../models/FinanceLog';
import { PostAwardContract } from '../../models/PostAwardContract';
import { PostAwardBilling } from '../../models/PostAwardBilling';
import { PostAwardAlert } from '../../models/PostAwardAlert';
import { PostAwardLog } from '../../models/PostAwardLog';
import { TenderSubmissionLog } from '../../models/TenderSubmissionLog';
import { ReportCache } from '../../models/ReportCache';
import { AnalyticsSummary } from '../../models/AnalyticsSummary';
import { ROLE_PERMISSIONS, TenderStatus, UserRole } from '../../types';
import {
  MisAlertsDto,
  MisAlertDto,
  MisContractsDto,
  MisDashboardDto,
  MisExecutiveSummaryDto,
  MisFilterQuery,
  MisFinanceSummaryDto,
  MisQuickInsightDto,
  MisRecentActivityDto,
  MisRevenueDto,
  MisSearchResultDto,
  MisServiceCategoryDto,
  MisTenderPerformanceDto,
  MisTenderValueDto,
} from '../../types/misReporting';

const PARTICIPATED_STATUSES = [TenderStatus.SUBMITTED, TenderStatus.AWARDED];
const CACHE_TTL_MS = 60_000;

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  'Security Services': 'Security',
  'Housekeeping Services': 'Housekeeping',
  'Manpower Services': 'Manpower',
  Horticulture: 'Horticulture',
  'Facility Management': 'Facility Management',
};

function parseDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function filtersHash(filters: MisFilterQuery): string {
  return crypto.createHash('sha256').update(JSON.stringify(filters)).digest('hex').slice(0, 16);
}

function buildDateRange(filters: MisFilterQuery): { $gte?: Date; $lte?: Date } | undefined {
  const from = parseDate(filters.dateFrom);
  const to = parseDate(filters.dateTo);
  if (!from && !to) return undefined;
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) range.$gte = from;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

function normalizeCategory(raw: string): string {
  if (!raw?.trim()) return 'Other Categories';
  return CATEGORY_DISPLAY_MAP[raw] || 'Other Categories';
}

interface TenderContext {
  tenderIds: Types.ObjectId[];
  participatedIds: Types.ObjectId[];
  wonIds: Types.ObjectId[];
  lostIds: Types.ObjectId[];
}

class MisReportingService {
  private resolvePermissions(role: UserRole) {
    const perms = ROLE_PERMISSIONS[role] || [];
    return {
      canViewFinance: perms.includes('mis:finance') || perms.includes('mis:full'),
      canViewContracts: perms.includes('mis:contracts') || perms.includes('mis:full'),
      canViewAll: perms.includes('mis:full') || perms.includes('mis:read'),
      canExport: perms.includes('mis:export'),
    };
  }

  private async resolveTenderContext(filters: MisFilterQuery): Promise<TenderContext> {
    const tenderFilter: FilterQuery<ITender> = {};
    const dateRange = buildDateRange(filters);
    if (dateRange) tenderFilter.updatedAt = dateRange;
    if (filters.tenderStatus) {
      tenderFilter.status = filters.tenderStatus;
    }
    if (filters.clientName?.trim()) {
      tenderFilter.authority = { $regex: filters.clientName.trim(), $options: 'i' };
    }

    let tenders = await Tender.find(tenderFilter).select('_id status estimatedValue').lean();

    if (filters.serviceCategory?.trim()) {
      const normalized = filters.serviceCategory.trim();
      const classifications = await TenderServiceClassification.find({
        serviceCategory: { $regex: normalized, $options: 'i' },
      })
        .select('tenderId')
        .lean();
      const allowed = new Set(classifications.map((c) => String(c.tenderId)));
      tenders = tenders.filter((t) => allowed.has(String(t._id)));
    }

    const participated = tenders.filter((t) => PARTICIPATED_STATUSES.includes(t.status as TenderStatus));
    const won = participated.filter((t) => t.status === TenderStatus.AWARDED);
    const lost = participated.filter((t) => t.status === TenderStatus.SUBMITTED);

    return {
      tenderIds: tenders.map((t) => t._id as Types.ObjectId),
      participatedIds: participated.map((t) => t._id as Types.ObjectId),
      wonIds: won.map((t) => t._id as Types.ObjectId),
      lostIds: lost.map((t) => t._id as Types.ObjectId),
    };
  }

  private buildContractFilter(filters: MisFilterQuery, tenderIds?: Types.ObjectId[]): FilterQuery<Record<string, unknown>> {
    const filter: FilterQuery<Record<string, unknown>> = {};
    if (filters.contractStatus) filter.status = filters.contractStatus;
    if (filters.clientName?.trim()) {
      filter.clientName = { $regex: filters.clientName.trim(), $options: 'i' };
    }
    if (tenderIds?.length) filter.tenderId = { $in: tenderIds };
    const dateRange = buildDateRange(filters);
    if (dateRange) filter.updatedAt = dateRange;
    return filter;
  }

  async getTenderPerformance(filters: MisFilterQuery = {}): Promise<MisTenderPerformanceDto> {
    const ctx = await this.resolveTenderContext(filters);
    const totalParticipated = ctx.participatedIds.length;
    const totalWon = ctx.wonIds.length;
    const totalLost = ctx.lostIds.length;
    const winRatePercent =
      totalParticipated > 0 ? Math.round((totalWon / totalParticipated) * 10000) / 100 : 0;

    return { totalParticipated, totalWon, totalLost, winRatePercent };
  }

  async getTenderValue(filters: MisFilterQuery = {}): Promise<MisTenderValueDto> {
    const ctx = await this.resolveTenderContext(filters);

    const [participatedTenders, contracts] = await Promise.all([
      Tender.find({ _id: { $in: ctx.participatedIds } })
        .select('estimatedValue status')
        .lean(),
      PostAwardContract.find({ tenderId: { $in: ctx.wonIds } })
        .select('contractValue tenderId')
        .lean(),
    ]);

    const contractValueByTender = new Map(
      contracts.map((c) => [String(c.tenderId), Number(c.contractValue ?? 0)])
    );

    let totalTenderValue = 0;
    let awardedTenderValue = 0;

    for (const t of participatedTenders) {
      const value = Number(t.estimatedValue ?? 0);
      totalTenderValue += value;
      if (t.status === TenderStatus.AWARDED) {
        awardedTenderValue += contractValueByTender.get(String(t._id)) ?? value;
      }
    }

    return {
      totalTenderValue,
      awardedTenderValue,
      lostTenderValue: Math.max(0, totalTenderValue - awardedTenderValue),
    };
  }

  async getServiceCategory(filters: MisFilterQuery = {}): Promise<MisServiceCategoryDto> {
    const ctx = await this.resolveTenderContext(filters);
    const classifications = await TenderServiceClassification.find({
      tenderId: { $in: ctx.tenderIds.length ? ctx.tenderIds : [] },
    })
      .select('tenderId serviceCategory')
      .lean();

    const counts = new Map<string, number>();
    const seenTenders = new Set<string>();

    for (const row of classifications) {
      const tid = String(row.tenderId);
      if (seenTenders.has(tid)) continue;
      seenTenders.add(tid);
      const label = normalizeCategory(String(row.serviceCategory || ''));
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    const defaultCategories = [
      'Security',
      'Housekeeping',
      'Manpower',
      'Horticulture',
      'Facility Management',
      'Other Categories',
    ];
    const categories = defaultCategories.map((category) => ({
      category,
      count: counts.get(category) || 0,
    }));

    return {
      categories,
      total: categories.reduce((s, c) => s + c.count, 0),
    };
  }

  async getFinanceSummary(filters: MisFilterQuery = {}): Promise<MisFinanceSummaryDto> {
    const ctx = await this.resolveTenderContext(filters);
    const tenderFilter = ctx.tenderIds.length ? { tenderId: { $in: ctx.tenderIds } } : {};

    const [records, refunds] = await Promise.all([
      FinanceRecord.find(tenderFilter).lean(),
      RefundRecord.find(tenderFilter).lean(),
    ]);

    const emdRecords = records.filter((r) => r.recordType === 'EMD');
    const bgRecords = records.filter((r) => r.recordType === 'BG');

    const emdLocked = emdRecords
      .filter((r) => r.status !== 'Refunded' && r.refundStatus !== 'received')
      .reduce((s, r) => s + r.amount, 0);

    const emdRefunded = emdRecords
      .filter((r) => r.refundStatus === 'received' || r.status === 'Refunded')
      .reduce((s, r) => s + r.amount, 0);

    const pendingRefund = refunds
      .filter((r) => r.status !== 'received')
      .reduce((s, r) => s + r.amount, 0);

    const receivedBg = bgRecords
      .filter((r) => r.status === 'Received' || r.status === 'Active' || r.status === 'Expiring Soon')
      .reduce((s, r) => s + r.amount, 0);

    const pendingBg = bgRecords
      .filter((r) => r.status === 'Pending' || r.status === 'Requested')
      .reduce((s, r) => s + r.amount, 0);

    const activeBg = bgRecords
      .filter((r) => r.status === 'Active' || r.status === 'Expiring Soon')
      .reduce((s, r) => s + r.amount, 0);

    return { emdLocked, emdRefunded, pendingRefund, receivedBg, pendingBg, activeBg };
  }

  async getContracts(filters: MisFilterQuery = {}): Promise<MisContractsDto> {
    const ctx = await this.resolveTenderContext(filters);
    const filter = this.buildContractFilter(filters, ctx.tenderIds.length ? ctx.tenderIds : undefined);
    const contracts = await PostAwardContract.find(filter).lean();
    const now = new Date();

    const inDays = (days: number) => {
      const end = new Date();
      end.setDate(end.getDate() + days);
      return { start: now, end };
    };

    const countExpiring = (days: number) => {
      const { start, end } = inDays(days);
      return contracts.filter(
        (c) => c.contractEndDate && c.contractEndDate >= start && c.contractEndDate <= end
      ).length;
    };

    return {
      runningContracts: contracts.filter((c) => c.status === 'active' || c.status === 'expiring_soon').length,
      completedContracts: contracts.filter((c) => c.status === 'completed').length,
      expiredContracts: contracts.filter((c) => c.status === 'expired').length,
      expiringIn30Days: countExpiring(30),
      expiringIn60Days: countExpiring(60),
      expiringIn90Days: countExpiring(90),
    };
  }

  async getRevenue(filters: MisFilterQuery = {}): Promise<MisRevenueDto> {
    const ctx = await this.resolveTenderContext(filters);
    const contractFilter = this.buildContractFilter(filters, ctx.tenderIds.length ? ctx.tenderIds : undefined);

    const [contracts, billing] = await Promise.all([
      PostAwardContract.find(contractFilter).lean(),
      PostAwardBilling.find(
        ctx.tenderIds.length ? { tenderId: { $in: ctx.tenderIds } } : {}
      ).lean(),
    ]);

    const contractValue = contracts.reduce((s, c) => s + (c.contractValue || 0), 0);
    const revenueReceived = contracts.reduce((s, c) => s + (c.revenueReceived || 0), 0);
    const revenuePending = contracts.reduce((s, c) => s + (c.revenuePending || 0), 0);
    const pendingBilling = contracts.reduce((s, c) => s + (c.pendingBilling || 0), 0);

    const totalInvoices = billing.length;
    const paidInvoices = billing.filter((b) => b.status === 'paid').length;
    const pendingInvoices = billing.filter((b) => b.status !== 'paid').length;

    return {
      contractValue,
      revenueReceived,
      revenuePending,
      pendingBilling,
      totalInvoices,
      paidInvoices,
      pendingInvoices,
    };
  }

  private mapFinanceAlert(a: Record<string, unknown>): MisAlertDto {
    const days = Number(a.daysUntilExpiry ?? 0);
    let priority: MisAlertDto['priority'] = 'medium';
    if (days < 0) priority = 'critical';
    else if (days <= 7) priority = 'critical';
    else if (days <= 15) priority = 'high';
    else if (days <= 30) priority = 'medium';
    else priority = 'low';

    const recordType = String(a.recordType || 'BG');
    const alertType = recordType === 'PBG' ? 'pbg_expiry' : 'bg_expiry';

    return {
      id: String(a._id),
      alertType,
      priority,
      title: `${recordType} Expiry Alert`,
      message: String(a.message || ''),
      tenderId: String(a.tenderId),
      dueDate: a.expiryDate ? new Date(String(a.expiryDate)).toISOString() : undefined,
      module: 'Finance Tracking',
    };
  }

  private mapPostAwardAlert(a: Record<string, unknown>): MisAlertDto {
    return {
      id: String(a._id),
      alertType: a.alertType as MisAlertDto['alertType'],
      priority: a.priority as MisAlertDto['priority'],
      title: String(a.title || ''),
      message: String(a.message || ''),
      tenderId: a.tenderId ? String(a.tenderId) : undefined,
      contractId: a.contractId ? String(a.contractId) : undefined,
      dueDate: a.dueDate ? new Date(String(a.dueDate)).toISOString() : undefined,
      module: 'Post-Award Follow-Up',
    };
  }

  async getAlerts(filters: MisFilterQuery = {}): Promise<MisAlertsDto> {
    const ctx = await this.resolveTenderContext(filters);
    const tenderFilter = ctx.tenderIds.length ? { tenderId: { $in: ctx.tenderIds } } : {};

    const [financeAlerts, postAwardAlerts] = await Promise.all([
      FinanceAlert.find(tenderFilter).sort({ daysUntilExpiry: 1 }).limit(100).lean(),
      PostAwardAlert.find({ isDismissed: false, ...tenderFilter })
        .sort({ priority: 1, createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const all: MisAlertDto[] = [
      ...financeAlerts.map((a) => this.mapFinanceAlert(a as unknown as Record<string, unknown>)),
      ...postAwardAlerts.map((a) => this.mapPostAwardAlert(a as unknown as Record<string, unknown>)),
    ];

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    all.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const bucket = (p: MisAlertDto['priority']) => all.filter((a) => a.priority === p);

    const critical = bucket('critical');
    const high = bucket('high');
    const medium = bucket('medium');
    const low = bucket('low');

    return {
      critical,
      high,
      medium,
      low,
      counts: {
        critical: critical.length,
        high: high.length,
        medium: medium.length,
        low: low.length,
        total: all.length,
      },
    };
  }

  async search(query: string, filters: MisFilterQuery = {}): Promise<MisSearchResultDto[]> {
    const term = query?.trim();
    if (!term || term.length < 2) return [];

    const ctx = await this.resolveTenderContext(filters);
    const regex = { $regex: term, $options: 'i' };

    const [tenders, contracts] = await Promise.all([
      Tender.find({
        ...(ctx.tenderIds.length ? { _id: { $in: ctx.tenderIds } } : {}),
        $or: [{ title: regex }, { tenderNumber: regex }, { authority: regex }],
      })
        .select('title tenderNumber authority status')
        .limit(25)
        .lean(),
      PostAwardContract.find({
        ...(ctx.tenderIds.length ? { tenderId: { $in: ctx.tenderIds } } : {}),
        $or: [
          { clientName: regex },
          { tenderNumber: regex },
          { tenderTitle: regex },
          { workOrderNumber: regex },
          { agreementNumber: regex },
          { purchaseOrderNumber: regex },
        ],
      })
        .limit(25)
        .lean(),
    ]);

    const results: MisSearchResultDto[] = [];

    for (const t of tenders) {
      results.push({
        id: String(t._id),
        type: 'tender',
        tenderId: String(t._id),
        tenderNumber: t.tenderNumber,
        tenderName: t.title,
        clientName: t.authority,
        status: t.status,
      });
    }

    for (const c of contracts) {
      results.push({
        id: String(c._id),
        type: 'contract',
        tenderId: String(c.tenderId),
        tenderNumber: c.tenderNumber,
        tenderName: c.tenderTitle,
        clientName: c.clientName,
        workOrderNumber: c.workOrderNumber,
        agreementNumber: c.agreementNumber,
        contractNumber: c.workOrderNumber || c.agreementNumber,
        status: c.status,
      });
    }

    return results.slice(0, 40);
  }

  async getRecentActivity(filters: MisFilterQuery = {}, limit = 30): Promise<MisRecentActivityDto[]> {
    const ctx = await this.resolveTenderContext(filters);
    const tenderFilter = ctx.tenderIds.length ? { tenderId: { $in: ctx.tenderIds } } : {};
    const perSource = Math.ceil(limit / 3);

    const [financeLogs, postAwardLogs, submissionLogs] = await Promise.all([
      FinanceLog.find(tenderFilter).sort({ createdAt: -1 }).limit(perSource).lean(),
      PostAwardLog.find(tenderFilter).sort({ createdAt: -1 }).limit(perSource).lean(),
      TenderSubmissionLog.find(tenderFilter).sort({ createdAt: -1 }).limit(perSource).lean(),
    ]);

    const items: MisRecentActivityDto[] = [];

    for (const l of financeLogs) {
      items.push({
        id: String(l._id),
        user: String(l.userName || 'System'),
        action: String(l.action || l.message || 'Finance update'),
        timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
        module: 'Finance Tracking',
        tenderId: String(l.tenderId),
      });
    }

    for (const l of postAwardLogs) {
      items.push({
        id: String(l._id),
        user: String(l.userName || 'System'),
        action: String(l.action || l.message || 'Post-award update'),
        timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
        module: 'Post-Award Follow-Up',
        tenderId: String(l.tenderId),
        contractId: l.contractId ? String(l.contractId) : undefined,
      });
    }

    for (const l of submissionLogs) {
      items.push({
        id: String(l._id),
        user: String(l.userName || 'System'),
        action: String(l.action || l.message || 'Submission update'),
        timestamp: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
        module: 'Submission Tracking',
        tenderId: String(l.tenderId),
      });
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  private buildQuickInsights(
    performance: MisTenderPerformanceDto,
    value: MisTenderValueDto,
    categories: MisServiceCategoryDto,
    finance: MisFinanceSummaryDto,
    contracts: MisContractsDto,
    revenue: MisRevenueDto
  ): MisQuickInsightDto[] {
    const topCategory = [...categories.categories].sort((a, b) => b.count - a.count)[0];
    const insights: MisQuickInsightDto[] = [];

    if (topCategory?.count) {
      insights.push({
        key: 'top_category',
        label: 'Top Performing Category',
        value: topCategory.category,
        detail: `${topCategory.count} tenders`,
      });
    }

    if (value.awardedTenderValue > 0) {
      insights.push({
        key: 'highest_value',
        label: 'Awarded Tender Value',
        value: `₹${(value.awardedTenderValue / 1_00_00_000).toFixed(2)} Cr`,
        detail: 'Total awarded contract value',
      });
    }

    if (contracts.expiringIn30Days > 0) {
      insights.push({
        key: 'expiring_soon',
        label: 'Contracts Expiring Soon',
        value: String(contracts.expiringIn30Days),
        detail: 'Within 30 days',
      });
    }

    if (finance.pendingRefund > 0) {
      insights.push({
        key: 'pending_refund',
        label: 'Pending Refund Amount',
        value: `₹${(finance.pendingRefund / 1_00_000).toFixed(2)} L`,
      });
    }

    insights.push({
      key: 'win_rate',
      label: 'Tender Win Rate',
      value: `${performance.winRatePercent}%`,
      detail: `${performance.totalWon} won of ${performance.totalParticipated} participated`,
    });

    if (revenue.revenuePending > 0) {
      insights.push({
        key: 'pending_revenue',
        label: 'Revenue Pending',
        value: `₹${(revenue.revenuePending / 1_00_00_000).toFixed(2)} Cr`,
      });
    }

    return insights;
  }

  private buildExecutiveSummary(
    performance: MisTenderPerformanceDto,
    value: MisTenderValueDto,
    finance: MisFinanceSummaryDto,
    contracts: MisContractsDto,
    revenue: MisRevenueDto
  ): MisExecutiveSummaryDto {
    return {
      participatedTenders: performance.totalParticipated,
      wonTenders: performance.totalWon,
      lostTenders: performance.totalLost,
      winRate: performance.winRatePercent,
      tenderValue: value.totalTenderValue,
      runningContracts: contracts.runningContracts,
      expiredContracts: contracts.expiredContracts,
      expiringContracts: contracts.expiringIn30Days,
      emdLocked: finance.emdLocked,
      pendingBg: finance.pendingBg,
      revenueReceived: revenue.revenueReceived,
      pendingRevenue: revenue.revenuePending,
      pendingBilling: revenue.pendingBilling,
    };
  }

  private async persistAnalyticsSnapshot(filters: MisFilterQuery, dashboard: Omit<MisDashboardDto, 'permissions'>) {
    const period = new Date().toISOString().slice(0, 10);
    await AnalyticsSummary.findOneAndUpdate(
      { summaryType: 'mis_dashboard', period },
      {
        $set: {
          data: dashboard,
          filters,
          computedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  private async readCache<T>(section: string, filters: MisFilterQuery): Promise<T | null> {
    const cacheKey = `${section}:${filtersHash(filters)}`;
    const cached = await ReportCache.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();
    return cached ? (cached.payload as T) : null;
  }

  private async writeCache(section: string, filters: MisFilterQuery, payload: Record<string, unknown>) {
    const cacheKey = `${section}:${filtersHash(filters)}`;
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await ReportCache.findOneAndUpdate(
      { cacheKey },
      {
        $set: {
          section,
          payload,
          filters,
          computedAt: new Date(),
          expiresAt,
        },
      },
      { upsert: true }
    );
  }

  async getDashboard(filters: MisFilterQuery = {}, role: UserRole = UserRole.MD): Promise<MisDashboardDto> {
    const permissions = this.resolvePermissions(role);

    const cached = await this.readCache<MisDashboardDto>('dashboard', filters);
    if (cached) {
      return { ...cached, permissions, generatedAt: new Date().toISOString() };
    }

    const [performance, value, serviceCategory, finance, contracts, revenue, alerts] = await Promise.all([
      this.getTenderPerformance(filters),
      this.getTenderValue(filters),
      this.getServiceCategory(filters),
      permissions.canViewFinance ? this.getFinanceSummary(filters) : this.emptyFinance(),
      permissions.canViewContracts ? this.getContracts(filters) : this.emptyContracts(),
      permissions.canViewFinance || permissions.canViewContracts
        ? this.getRevenue(filters)
        : this.emptyRevenue(),
      this.getAlerts(filters),
    ]);

    const summary = this.buildExecutiveSummary(performance, value, finance, contracts, revenue);
    const quickInsights = this.buildQuickInsights(
      performance,
      value,
      serviceCategory,
      finance,
      contracts,
      revenue
    );

    const dashboard: MisDashboardDto = {
      summary,
      tenderPerformance: performance,
      tenderValue: value,
      serviceCategory,
      finance,
      contracts,
      revenue,
      alerts,
      quickInsights,
      filters,
      generatedAt: new Date().toISOString(),
      permissions,
    };

    await this.writeCache('dashboard', filters, dashboard as unknown as Record<string, unknown>);
    await this.persistAnalyticsSnapshot(filters, {
      summary,
      tenderPerformance: performance,
      tenderValue: value,
      serviceCategory,
      finance,
      contracts,
      revenue,
      alerts,
      quickInsights,
      filters,
      generatedAt: dashboard.generatedAt,
    });

    return dashboard;
  }

  private emptyFinance(): MisFinanceSummaryDto {
    return {
      emdLocked: 0,
      emdRefunded: 0,
      pendingRefund: 0,
      receivedBg: 0,
      pendingBg: 0,
      activeBg: 0,
    };
  }

  private emptyContracts(): MisContractsDto {
    return {
      runningContracts: 0,
      completedContracts: 0,
      expiredContracts: 0,
      expiringIn30Days: 0,
      expiringIn60Days: 0,
      expiringIn90Days: 0,
    };
  }

  private emptyRevenue(): MisRevenueDto {
    return {
      contractValue: 0,
      revenueReceived: 0,
      revenuePending: 0,
      pendingBilling: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      pendingInvoices: 0,
    };
  }
}

export const misReportingService = new MisReportingService();
