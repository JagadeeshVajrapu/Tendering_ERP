import { Types } from 'mongoose';
import { Tender } from '../../models/Tender';
import { User } from '../../models/User';
import { FinanceRecord } from '../../models/FinanceRecord';
import { RefundRecord } from '../../models/RefundRecord';
import { FinanceAlert } from '../../models/FinanceAlert';
import { FinanceLog } from '../../models/FinanceLog';
import { FinanceTask } from '../../models/FinanceTask';
import { PostAwardContract } from '../../models/PostAwardContract';
import { PostAwardBilling } from '../../models/PostAwardBilling';
import { PostAwardAlert } from '../../models/PostAwardAlert';
import { PostAwardLog } from '../../models/PostAwardLog';
import { TenderSubmissionLog } from '../../models/TenderSubmissionLog';
import { TenderSubmissionTracking } from '../../models/TenderSubmissionTracking';
import { AppError } from '../../middleware/errorHandler';
import { TenderStatus, UserRole } from '../../types';
import {
  AdminContractOverviewDto,
  AdminCriticalAlertDto,
  AdminDashboardDto,
  AdminExecutivePerformanceDto,
  AdminFinancialOverviewDto,
  AdminRecentActivityDto,
  AdminRevenueBillingDto,
  AdminTenderOverviewDto,
  AdminUserDto,
} from '../../types/adminDashboard';

const PARTICIPATED = [TenderStatus.SUBMITTED, TenderStatus.AWARDED];
const TERMINAL_REJECTED = [TenderStatus.REJECTED_BY_MD, TenderStatus.FINANCE_REJECTED];

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function isBgExpired(record: { expiryDate?: Date; status?: string }): boolean {
  if (record.status === 'Expired') return true;
  if (record.expiryDate && daysUntil(record.expiryDate) < 0) return true;
  return false;
}

class AdminDashboardService {
  async getTenderOverview(): Promise<AdminTenderOverviewDto> {
    const tenders = await Tender.find().select('status estimatedValue').lean();

    const submitted = tenders.filter((t) => t.status === TenderStatus.SUBMITTED);
    const awarded = tenders.filter((t) => t.status === TenderStatus.AWARDED);
    const participated = tenders.filter((t) => PARTICIPATED.includes(t.status as TenderStatus));
    const active = tenders.filter(
      (t) =>
        !PARTICIPATED.includes(t.status as TenderStatus) &&
        !TERMINAL_REJECTED.includes(t.status as TenderStatus)
    );

    const totalTenderValue = participated.reduce((s, t) => s + (t.estimatedValue || 0), 0);
    const winRatePercent =
      participated.length > 0
        ? Math.round((awarded.length / participated.length) * 10000) / 100
        : 0;

    return {
      totalTenders: tenders.length,
      activeTenders: active.length,
      submittedTenders: participated.length,
      awardedTenders: awarded.length,
      lostTenders: submitted.length,
      totalTenderValue,
      winRatePercent,
    };
  }

  async getExecutivePerformance(): Promise<AdminExecutivePerformanceDto[]> {
    const executives = await User.find({ role: UserRole.EXECUTIVE, isActive: true })
      .select('name email')
      .lean();

    const tenders = await Tender.find({
      $or: [{ createdBy: { $exists: true } }, { assignedExecutive: { $exists: true } }],
    })
      .select('createdBy assignedExecutive status')
      .lean();

    const pendingTasks = await FinanceTask.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $in: ['pending', 'in_progress'] } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]);
    const taskMap = new Map(
      pendingTasks.filter((t) => t._id).map((t) => [String(t._id), t.count])
    );

    return executives.map((exec) => {
      const execId = String(exec._id);
      const assigned = tenders.filter(
        (t) => String(t.createdBy) === execId || String(t.assignedExecutive) === execId
      );
      const submitted = assigned.filter((t) => PARTICIPATED.includes(t.status as TenderStatus));
      const awarded = assigned.filter((t) => t.status === TenderStatus.AWARDED);
      const winRate =
        submitted.length > 0 ? Math.round((awarded.length / submitted.length) * 10000) / 100 : 0;

      return {
        executiveId: execId,
        executiveName: exec.name,
        email: exec.email,
        assignedTenders: assigned.length,
        submittedTenders: submitted.length,
        awardedTenders: awarded.length,
        winRatePercent: winRate,
        pendingTasks: taskMap.get(execId) || 0,
      };
    });
  }

  async getFinancialOverview(): Promise<AdminFinancialOverviewDto> {
    const [records, refunds] = await Promise.all([
      FinanceRecord.find().lean(),
      RefundRecord.find().lean(),
    ]);

    const byType = (type: string) => records.filter((r) => r.recordType === type);
    const emd = byType('EMD');
    const bg = byType('BG');
    const pbg = byType('PBG');

    return {
      emdLocked: emd
        .filter((r) => r.refundStatus !== 'received' && r.status !== 'Refunded')
        .reduce((s, r) => s + r.amount, 0),
      emdRefunded: emd
        .filter((r) => r.refundStatus === 'received' || r.status === 'Refunded')
        .reduce((s, r) => s + r.amount, 0),
      pendingRefundAmount: refunds
        .filter((r) => r.status !== 'received')
        .reduce((s, r) => s + r.amount, 0),
      activeBg: bg
        .filter((r) => r.status === 'Active' || r.status === 'Expiring Soon')
        .reduce((s, r) => s + r.amount, 0),
      pendingBg: bg
        .filter((r) => r.status === 'Pending' || r.status === 'Requested')
        .reduce((s, r) => s + r.amount, 0),
      expiredBg: bg.filter(isBgExpired).reduce((s, r) => s + r.amount, 0),
      tenderFeesPaid: byType('TENDER_FEE')
        .filter((r) => r.status === 'Paid' || r.paymentDate)
        .reduce((s, r) => s + r.amount, 0),
      securityDeposits: byType('SECURITY_DEPOSIT').reduce((s, r) => s + r.amount, 0),
      pbgActive: pbg
        .filter((r) => r.status === 'Active' || r.status === 'Expiring Soon')
        .reduce((s, r) => s + r.amount, 0),
      pbgExpired: pbg.filter(isBgExpired).reduce((s, r) => s + r.amount, 0),
      pbgPending: pbg
        .filter((r) => r.status === 'Pending' || r.status === 'Requested')
        .reduce((s, r) => s + r.amount, 0),
    };
  }

  async getRevenueBilling(): Promise<AdminRevenueBillingDto> {
    const [contracts, billing] = await Promise.all([
      PostAwardContract.find().lean(),
      PostAwardBilling.find().lean(),
    ]);

    return {
      totalContractValue: contracts.reduce((s, c) => s + (c.contractValue || 0), 0),
      revenueReceived: contracts.reduce((s, c) => s + (c.revenueReceived || 0), 0),
      revenuePending: contracts.reduce((s, c) => s + (c.revenuePending || 0), 0),
      pendingBilling: contracts.reduce((s, c) => s + (c.pendingBilling || 0), 0),
      paidInvoices: billing.filter((b) => b.status === 'paid').length,
      unpaidInvoices: billing.filter((b) => b.status !== 'paid').length,
      totalInvoices: billing.length,
    };
  }

  async getContractOverview(): Promise<AdminContractOverviewDto> {
    const contracts = await PostAwardContract.find().lean();
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    const expiring = (date?: Date) => date && date >= now && date <= in30;

    return {
      runningContracts: contracts.filter(
        (c) => c.status === 'active' || c.status === 'expiring_soon'
      ).length,
      completedContracts: contracts.filter((c) => c.status === 'completed').length,
      contractsExpiringSoon: contracts.filter((c) => expiring(c.contractEndDate)).length,
      amcExpiringSoon: contracts.filter((c) => expiring(c.amcEndDate)).length,
      agreementsExpiringSoon: contracts.filter((c) => expiring(c.agreementExpiryDate)).length,
    };
  }

  async getCriticalAlerts(): Promise<AdminCriticalAlertDto[]> {
    const now = new Date();
    const in14 = new Date();
    in14.setDate(in14.getDate() + 14);

    const [financeAlerts, postAwardAlerts, submissionDeadlines, pendingRefunds] =
      await Promise.all([
        FinanceAlert.find().sort({ daysUntilExpiry: 1 }).limit(30).lean(),
        PostAwardAlert.find({ isDismissed: false, priority: { $in: ['critical', 'high'] } })
          .sort({ priority: 1, createdAt: -1 })
          .limit(30)
          .lean(),
        TenderSubmissionTracking.find({
          status: { $ne: 'submitted' },
          deadlineAt: { $gte: now, $lte: in14 },
        })
          .limit(20)
          .lean(),
        RefundRecord.find({ status: { $ne: 'received' } }).limit(10).lean(),
      ]);

    const alerts: AdminCriticalAlertDto[] = [];

    for (const a of financeAlerts) {
      const days = a.daysUntilExpiry ?? 0;
      alerts.push({
        id: String(a._id),
        alertType: a.recordType === 'PBG' ? 'pbg_expiry' : 'bg_expiry',
        priority: days <= 7 ? 'critical' : days <= 15 ? 'high' : 'medium',
        title: `${a.recordType} Expiry`,
        message: String(a.message),
        module: 'Finance Tracking',
        tenderId: String(a.tenderId),
        dueDate: a.expiryDate?.toISOString(),
      });
    }

    for (const a of postAwardAlerts) {
      alerts.push({
        id: String(a._id),
        alertType: String(a.alertType),
        priority: a.priority as AdminCriticalAlertDto['priority'],
        title: String(a.title),
        message: String(a.message),
        module: 'Post-Award',
        tenderId: String(a.tenderId),
        contractId: String(a.contractId),
        dueDate: a.dueDate?.toISOString(),
      });
    }

    for (const s of submissionDeadlines) {
      const days = s.deadlineAt ? daysUntil(s.deadlineAt) : 0;
      alerts.push({
        id: `submission-${String(s._id)}`,
        alertType: 'submission_deadline',
        priority: days <= 3 ? 'critical' : 'high',
        title: 'Submission Deadline Approaching',
        message: s.deadlineLabel || `Tender submission due in ${days} day(s)`,
        module: 'Submission Tracking',
        tenderId: String(s.tenderId),
        dueDate: s.deadlineAt?.toISOString(),
      });
    }

    for (const r of pendingRefunds) {
      alerts.push({
        id: `refund-${String(r._id)}`,
        alertType: 'pending_refund',
        priority: 'high',
        title: 'Pending Refund',
        message: `${r.instrumentLabel} — ₹${r.amount.toLocaleString('en-IN')} awaiting refund`,
        module: 'Finance Tracking',
        tenderId: String(r.tenderId),
      });
    }

    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return alerts
      .sort((a, b) => order[a.priority] - order[b.priority])
      .slice(0, 25);
  }

  async getRecentActivity(limit = 25): Promise<AdminRecentActivityDto[]> {
    const perSource = Math.ceil(limit / 3);

    const [financeLogs, postAwardLogs, submissionLogs] = await Promise.all([
      FinanceLog.find().sort({ createdAt: -1 }).limit(perSource).lean(),
      PostAwardLog.find().sort({ createdAt: -1 }).limit(perSource).lean(),
      TenderSubmissionLog.find().sort({ createdAt: -1 }).limit(perSource).lean(),
    ]);

    const items: AdminRecentActivityDto[] = [];

    for (const l of financeLogs) {
      items.push({
        id: String(l._id),
        user: l.userName,
        action: l.action || l.message,
        timestamp: l.createdAt?.toISOString() || new Date().toISOString(),
        module: 'Finance',
        tenderId: String(l.tenderId),
      });
    }
    for (const l of postAwardLogs) {
      items.push({
        id: String(l._id),
        user: l.userName,
        action: l.action || l.message,
        timestamp: l.createdAt?.toISOString() || new Date().toISOString(),
        module: 'Post-Award',
        tenderId: String(l.tenderId),
      });
    }
    for (const l of submissionLogs) {
      items.push({
        id: String(l._id),
        user: l.userName,
        action: l.action || l.message,
        timestamp: l.createdAt?.toISOString() || new Date().toISOString(),
        module: 'Submission',
        tenderId: String(l.tenderId),
      });
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getDashboard(): Promise<AdminDashboardDto> {
    const [
      tenderOverview,
      executivePerformance,
      financialOverview,
      revenueBilling,
      contractOverview,
      criticalAlerts,
      recentActivity,
    ] = await Promise.all([
      this.getTenderOverview(),
      this.getExecutivePerformance(),
      this.getFinancialOverview(),
      this.getRevenueBilling(),
      this.getContractOverview(),
      this.getCriticalAlerts(),
      this.getRecentActivity(),
    ]);

    return {
      tenderOverview,
      executivePerformance,
      financialOverview,
      revenueBilling,
      contractOverview,
      criticalAlerts,
      recentActivity,
      generatedAt: new Date().toISOString(),
    };
  }

  async listUsers(): Promise<AdminUserDto[]> {
    const users = await User.find().select('-password').sort({ name: 1 }).lean();
    return users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      isActive: u.isActive,
      lastLogin: u.lastLogin?.toISOString(),
      createdAt: u.createdAt?.toISOString(),
    }));
  }

  async updateUser(
    userId: string,
    updates: { role?: UserRole; isActive?: boolean; department?: string }
  ): Promise<AdminUserDto> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) throw new AppError('User not found', 404);
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      lastLogin: user.lastLogin?.toISOString(),
      createdAt: user.createdAt?.toISOString(),
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
