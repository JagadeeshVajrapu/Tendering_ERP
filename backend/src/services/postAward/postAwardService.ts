import fs from 'fs/promises';
import { FilterQuery, Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { PostAwardContract, IPostAwardContract } from '../../models/PostAwardContract';
import { PostAwardRevenue } from '../../models/PostAwardRevenue';
import { PostAwardBilling } from '../../models/PostAwardBilling';
import { PostAwardDocument } from '../../models/PostAwardDocument';
import { PostAwardRenewal } from '../../models/PostAwardRenewal';
import { PostAwardAlert } from '../../models/PostAwardAlert';
import { PostAwardLog } from '../../models/PostAwardLog';
import { PostAwardAlertRule } from '../../models/PostAwardAlertRule';
import { NotificationType, TenderStatus, UserRole } from '../../types';
import {
  CreateBillingInput,
  CreateRevenueInput,
  PostAwardAlertDto,
  PostAwardContractDetailDto,
  PostAwardContractDto,
  PostAwardDashboardDto,
  PostAwardLogDto,
  PostAwardSearchQuery,
  PostAwardSummaryDto,
  UpdateContractInput,
} from '../../types/postAward';
import { fileStorageService } from '../storage/fileStorageService';
import { auditService } from '../audit/auditService';
import { notificationService } from '../notification/notificationService';

const DEFAULT_ALERT_RULES = [
  { alertType: 'contract_expiry' as const, daysBeforeExpiry: 7, priority: 'critical' as const },
  { alertType: 'contract_expiry' as const, daysBeforeExpiry: 30, priority: 'high' as const },
  { alertType: 'amc_expiry' as const, daysBeforeExpiry: 7, priority: 'critical' as const },
  { alertType: 'amc_expiry' as const, daysBeforeExpiry: 30, priority: 'high' as const },
  { alertType: 'agreement_expiry' as const, daysBeforeExpiry: 15, priority: 'high' as const },
  { alertType: 'revenue_delay' as const, daysBeforeExpiry: 0, priority: 'medium' as const },
  { alertType: 'pending_billing' as const, daysBeforeExpiry: 0, priority: 'medium' as const },
];

function postAwardFolder(tenderId: string): string {
  return `post-award/${tenderId}`;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function parseDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

interface RequestContext {
  userId: Types.ObjectId;
  userRole: UserRole;
  userName: string;
  ipAddress?: string;
}

class PostAwardService {
  private mapContract(doc: Record<string, unknown>): PostAwardContractDto {
    return {
      id: String(doc._id),
      tenderId: String(doc.tenderId),
      clientName: String(doc.clientName),
      tenderNumber: doc.tenderNumber as string | undefined,
      tenderTitle: String(doc.tenderTitle),
      workOrderNumber: doc.workOrderNumber as string | undefined,
      agreementNumber: doc.agreementNumber as string | undefined,
      purchaseOrderNumber: doc.purchaseOrderNumber as string | undefined,
      contractValue: Number(doc.contractValue ?? 0),
      contractStartDate: doc.contractStartDate
        ? new Date(String(doc.contractStartDate)).toISOString()
        : undefined,
      contractEndDate: doc.contractEndDate
        ? new Date(String(doc.contractEndDate)).toISOString()
        : undefined,
      amcStartDate: doc.amcStartDate ? new Date(String(doc.amcStartDate)).toISOString() : undefined,
      amcEndDate: doc.amcEndDate ? new Date(String(doc.amcEndDate)).toISOString() : undefined,
      agreementExpiryDate: doc.agreementExpiryDate
        ? new Date(String(doc.agreementExpiryDate)).toISOString()
        : undefined,
      status: doc.status as PostAwardContractDto['status'],
      renewalStatus: doc.renewalStatus as PostAwardContractDto['renewalStatus'],
      totalRevenue: Number(doc.totalRevenue ?? 0),
      revenueReceived: Number(doc.revenueReceived ?? 0),
      revenuePending: Number(doc.revenuePending ?? 0),
      pendingBilling: Number(doc.pendingBilling ?? 0),
      activatedAt: new Date(String(doc.activatedAt)).toISOString(),
      awardedAt: doc.awardedAt ? new Date(String(doc.awardedAt)).toISOString() : undefined,
      createdAt: doc.createdAt
        ? new Date(String(doc.createdAt)).toISOString()
        : new Date().toISOString(),
      updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)).toISOString() : undefined,
    };
  }

  private async log(
    tenderId: string,
    ctx: RequestContext,
    action: string,
    message: string,
    opts?: {
      contractId?: string;
      previousValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
    }
  ) {
    await PostAwardLog.create({
      tenderId: new Types.ObjectId(tenderId),
      contractId: opts?.contractId ? new Types.ObjectId(opts.contractId) : undefined,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: ctx.userRole,
      action,
      message,
      previousValue: opts?.previousValue,
      newValue: opts?.newValue,
      ipAddress: ctx.ipAddress,
    });

    await auditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action,
      entityType: 'post_award',
      entityId: opts?.contractId || tenderId,
      ipAddress: ctx.ipAddress,
      oldValue: opts?.previousValue,
      newValue: opts?.newValue,
      metadata: { tenderId, contractId: opts?.contractId },
    });
  }

  async ensureAlertRules() {
    for (const rule of DEFAULT_ALERT_RULES) {
      await PostAwardAlertRule.findOneAndUpdate(
        { alertType: rule.alertType, daysBeforeExpiry: rule.daysBeforeExpiry },
        { $setOnInsert: { ...rule, enabled: true } },
        { upsert: true }
      );
    }
  }

  async activateOnAward(tenderId: string, ctx: RequestContext) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);
    if (tender.status !== TenderStatus.AWARDED) {
      throw new AppError('Post-award module requires tender status Awarded', 400);
    }

    const existing = await PostAwardContract.findOne({ tenderId });
    if (existing) return this.mapContract(existing.toObject() as unknown as Record<string, unknown>);

    const clientName = tender.authority || tender.title;
    const contract = await PostAwardContract.create({
      tenderId: new Types.ObjectId(tenderId),
      clientName,
      tenderNumber: tender.tenderNumber,
      tenderTitle: tender.title,
      contractValue: tender.estimatedValue || 0,
      status: 'active',
      renewalStatus: 'active',
      activatedAt: new Date(),
      awardedAt: new Date(),
    });

    await PostAwardRenewal.create([
      { contractId: contract._id, tenderId: contract.tenderId, renewalType: 'contract', status: 'active' },
      { contractId: contract._id, tenderId: contract.tenderId, renewalType: 'amc', status: 'active' },
      { contractId: contract._id, tenderId: contract.tenderId, renewalType: 'agreement', status: 'active' },
    ]);

    await this.log(tenderId, ctx, 'post_award_activated', 'Post-award contract record initialized', {
      contractId: String(contract._id),
      newValue: { clientName, tenderTitle: tender.title },
    });

    await notificationService.notifyRole(
      UserRole.EXECUTIVE,
      NotificationType.TENDER_STATUS,
      'Contract awarded — post-award activated',
      `"${tender.title}" is now available in Post-Award Follow-Up.`,
      'PostAwardContract',
      contract._id
    );

    return this.mapContract(contract.toObject() as unknown as Record<string, unknown>);
  }

  async markTenderAwarded(tenderId: string, ctx: RequestContext) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const previousStatus = tender.status;
    if (previousStatus !== TenderStatus.SUBMITTED && previousStatus !== TenderStatus.READY_FOR_BID) {
      throw new AppError('Tender must be submitted before marking as awarded', 400);
    }

    tender.status = TenderStatus.AWARDED;
    tender.currentStage = 'Awarded';
    await tender.save();

    const contract = await this.activateOnAward(tenderId, ctx);
    await this.syncAlerts(tenderId);

    return { tender: { id: tenderId, status: tender.status, currentStage: tender.currentStage }, contract };
  }

  async markTenderSubmitted(tenderId: string) {
    await Tender.findByIdAndUpdate(tenderId, {
      status: TenderStatus.SUBMITTED,
      currentStage: 'Submitted',
    });
  }

  private buildSearchFilter(query: PostAwardSearchQuery): FilterQuery<IPostAwardContract> {
    const filter: FilterQuery<IPostAwardContract> = {};
    if (query.status) filter.status = query.status;
    if (query.clientName) filter.clientName = { $regex: query.clientName, $options: 'i' };

    if (query.expiringWithinDays != null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + query.expiringWithinDays);
      filter.$or = [
        { contractEndDate: { $lte: cutoff, $gte: new Date() } },
        { amcEndDate: { $lte: cutoff, $gte: new Date() } },
      ];
    }

    if (query.q?.trim()) {
      const term = query.q.trim();
      if (query.match === 'exact') {
        filter.$or = [
          { clientName: term },
          { tenderNumber: term },
          { tenderTitle: term },
          { workOrderNumber: term },
          { agreementNumber: term },
          { purchaseOrderNumber: term },
        ];
      } else {
        const regex = { $regex: term, $options: 'i' };
        filter.$or = [
          { clientName: regex },
          { tenderNumber: regex },
          { tenderTitle: regex },
          { workOrderNumber: regex },
          { agreementNumber: regex },
          { purchaseOrderNumber: regex },
        ];
      }
    }

    return filter;
  }

  private async computeSummary(filter: FilterQuery<IPostAwardContract>): Promise<PostAwardSummaryDto> {
    const contracts = await PostAwardContract.find(filter).lean();
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    return {
      totalAwardedContracts: contracts.length,
      activeContracts: contracts.filter((c) => c.status === 'active').length,
      contractsExpiringSoon: contracts.filter(
        (c) => c.contractEndDate && c.contractEndDate <= in30 && c.contractEndDate >= now
      ).length,
      amcExpiringSoon: contracts.filter(
        (c) => c.amcEndDate && c.amcEndDate <= in30 && c.amcEndDate >= now
      ).length,
      totalRevenue: contracts.reduce((s, c) => s + (c.totalRevenue || 0), 0),
      revenueReceived: contracts.reduce((s, c) => s + (c.revenueReceived || 0), 0),
      revenuePending: contracts.reduce((s, c) => s + (c.revenuePending || 0), 0),
      pendingBilling: contracts.reduce((s, c) => s + (c.pendingBilling || 0), 0),
    };
  }

  async getDashboard(query: PostAwardSearchQuery = {}): Promise<PostAwardDashboardDto> {
    await this.ensureAlertRules();
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const filter = this.buildSearchFilter(query);
    const sortBy = query.sortBy || 'awardedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const total = await PostAwardContract.countDocuments(filter);
    const contracts = await PostAwardContract.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const alerts = await PostAwardAlert.find({ isDismissed: false })
      .sort({ priority: 1, createdAt: -1 })
      .limit(20)
      .lean();

    const recentActivity = await PostAwardLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      summary: await this.computeSummary({}),
      contracts: {
        items: contracts.map((c) => this.mapContract(c as unknown as Record<string, unknown>)),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      alerts: alerts.map((a) => this.mapAlert(a)),
      recentActivity: recentActivity.map((l) => this.mapLog(l)),
    };
  }

  private mapAlert(a: Record<string, unknown>): PostAwardAlertDto {
    return {
      id: String(a._id),
      contractId: String(a.contractId),
      tenderId: String(a.tenderId),
      alertType: a.alertType as PostAwardAlertDto['alertType'],
      priority: a.priority as PostAwardAlertDto['priority'],
      title: String(a.title),
      message: String(a.message),
      dueDate: a.dueDate ? new Date(String(a.dueDate)).toISOString() : undefined,
      isDismissed: Boolean(a.isDismissed),
      createdAt: a.createdAt ? new Date(String(a.createdAt)).toISOString() : new Date().toISOString(),
    };
  }

  private mapLog(l: Record<string, unknown>): PostAwardLogDto {
    return {
      id: String(l._id),
      tenderId: String(l.tenderId),
      contractId: l.contractId ? String(l.contractId) : undefined,
      userId: String(l.userId),
      userName: String(l.userName),
      userRole: String(l.userRole),
      action: String(l.action),
      message: String(l.message),
      previousValue: l.previousValue as Record<string, unknown> | undefined,
      newValue: l.newValue as Record<string, unknown> | undefined,
      createdAt: l.createdAt ? new Date(String(l.createdAt)).toISOString() : new Date().toISOString(),
    };
  }

  async getContractByTender(tenderId: string): Promise<PostAwardContractDetailDto | null> {
    const contract = await PostAwardContract.findOne({ tenderId }).lean();
    if (!contract) return null;
    return this.getContractDetail(String(contract._id));
  }

  async getContractDetail(contractId: string): Promise<PostAwardContractDetailDto> {
    const contract = await PostAwardContract.findById(contractId).lean();
    if (!contract) throw new AppError('Post-award contract not found', 404);

    const [revenue, billing, documents, activityLog] = await Promise.all([
      PostAwardRevenue.find({ contractId }).sort({ createdAt: -1 }).populate('createdBy', 'name').lean(),
      PostAwardBilling.find({ contractId }).sort({ createdAt: -1 }).populate('createdBy', 'name').lean(),
      PostAwardDocument.find({ contractId }).sort({ createdAt: -1 }).populate('uploadedBy', 'name').lean(),
      PostAwardLog.find({ contractId }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    return {
      ...this.mapContract(contract as unknown as Record<string, unknown>),
      revenue: revenue.map((r) => ({
        id: String(r._id),
        contractId: String(r.contractId),
        tenderId: String(r.tenderId),
        description: r.description,
        amount: r.amount,
        dueDate: r.dueDate?.toISOString(),
        receivedDate: r.receivedDate?.toISOString(),
        receivedAmount: r.receivedAmount,
        status: r.status,
        approvalStatus: r.approvalStatus,
        createdBy: String(r.createdBy),
        createdByName: (r.createdBy as { name?: string })?.name,
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      })),
      billing: billing.map((b) => ({
        id: String(b._id),
        contractId: String(b.contractId),
        tenderId: String(b.tenderId),
        invoiceNumber: b.invoiceNumber,
        description: b.description,
        amount: b.amount,
        billingDate: b.billingDate?.toISOString(),
        status: b.status,
        approvalStatus: b.approvalStatus,
        createdBy: String(b.createdBy),
        createdByName: (b.createdBy as { name?: string })?.name,
        createdAt: b.createdAt?.toISOString() || new Date().toISOString(),
      })),
      documents: documents.map((d) => ({
        id: String(d._id),
        contractId: String(d.contractId),
        tenderId: String(d.tenderId),
        documentType: d.documentType,
        fileName: d.fileName,
        originalName: d.originalName,
        mimeType: d.mimeType,
        documentNumber: d.documentNumber,
        uploadedBy: String(d.uploadedBy),
        uploadedByName: (d.uploadedBy as { name?: string })?.name,
        uploadedAt: d.createdAt?.toISOString() || new Date().toISOString(),
      })),
      activityLog: activityLog.map((l) => this.mapLog(l as unknown as Record<string, unknown>)),
    };
  }

  async updateContract(tenderId: string, ctx: RequestContext, input: UpdateContractInput) {
    const contract = await PostAwardContract.findOne({ tenderId });
    if (!contract) throw new AppError('Post-award contract not found', 404);

    const previous = contract.toObject();
    if (input.clientName !== undefined) contract.clientName = input.clientName;
    if (input.workOrderNumber !== undefined) contract.workOrderNumber = input.workOrderNumber;
    if (input.agreementNumber !== undefined) contract.agreementNumber = input.agreementNumber;
    if (input.purchaseOrderNumber !== undefined) contract.purchaseOrderNumber = input.purchaseOrderNumber;
    if (input.contractValue !== undefined) contract.contractValue = input.contractValue;
    if (input.contractStartDate !== undefined) contract.contractStartDate = parseDate(input.contractStartDate);
    if (input.contractEndDate !== undefined) contract.contractEndDate = parseDate(input.contractEndDate);
    if (input.amcStartDate !== undefined) contract.amcStartDate = parseDate(input.amcStartDate);
    if (input.amcEndDate !== undefined) contract.amcEndDate = parseDate(input.amcEndDate);
    if (input.agreementExpiryDate !== undefined) {
      contract.agreementExpiryDate = parseDate(input.agreementExpiryDate);
    }

    await contract.save();
    await this.syncAlerts(tenderId);

    await this.log(tenderId, ctx, 'contract_updated', 'Contract details updated', {
      contractId: String(contract._id),
      previousValue: previous as unknown as Record<string, unknown>,
      newValue: contract.toObject() as unknown as Record<string, unknown>,
    });

    return this.mapContract(contract.toObject() as unknown as Record<string, unknown>);
  }

  async addRevenue(tenderId: string, ctx: RequestContext, input: CreateRevenueInput) {
    const contract = await PostAwardContract.findOne({ tenderId });
    if (!contract) throw new AppError('Post-award contract not found', 404);

    const entry = await PostAwardRevenue.create({
      contractId: contract._id,
      tenderId: contract.tenderId,
      description: input.description,
      amount: input.amount,
      dueDate: parseDate(input.dueDate),
      createdBy: ctx.userId,
    });

    contract.totalRevenue += input.amount;
    contract.revenuePending += input.amount;
    await contract.save();
    await this.syncAlerts(tenderId);

    await this.log(tenderId, ctx, 'revenue_added', `Revenue entry: ${input.description}`, {
      contractId: String(contract._id),
      newValue: { amount: input.amount },
    });

    return { id: String(entry._id), amount: entry.amount };
  }

  async approveRevenue(revenueId: string, ctx: RequestContext, approved: boolean) {
    const entry = await PostAwardRevenue.findById(revenueId);
    if (!entry) throw new AppError('Revenue entry not found', 404);

    entry.approvalStatus = approved ? 'approved' : 'rejected';
    if (approved) entry.approvedBy = ctx.userId;
    await entry.save();

    await this.log(String(entry.tenderId), ctx, 'revenue_approval', `Revenue ${approved ? 'approved' : 'rejected'}`, {
      contractId: String(entry.contractId),
    });

    return { id: String(entry._id), approvalStatus: entry.approvalStatus };
  }

  async recordRevenueReceived(revenueId: string, ctx: RequestContext, receivedAmount: number) {
    const entry = await PostAwardRevenue.findById(revenueId);
    if (!entry) throw new AppError('Revenue entry not found', 404);
    if (entry.approvalStatus !== 'approved') {
      throw new AppError('Revenue must be approved before recording receipt', 400);
    }

    entry.receivedAmount = receivedAmount;
    entry.receivedDate = new Date();
    entry.status =
      receivedAmount >= entry.amount ? 'received' : receivedAmount > 0 ? 'partial' : entry.status;
    await entry.save();

    const contract = await PostAwardContract.findById(entry.contractId);
    if (contract) {
      contract.revenueReceived += receivedAmount;
      contract.revenuePending = Math.max(0, contract.revenuePending - receivedAmount);
      await contract.save();
    }

    return { id: String(entry._id), status: entry.status };
  }

  async addBilling(tenderId: string, ctx: RequestContext, input: CreateBillingInput) {
    const contract = await PostAwardContract.findOne({ tenderId });
    if (!contract) throw new AppError('Post-award contract not found', 404);

    const entry = await PostAwardBilling.create({
      contractId: contract._id,
      tenderId: contract.tenderId,
      invoiceNumber: input.invoiceNumber,
      description: input.description,
      amount: input.amount,
      billingDate: parseDate(input.billingDate),
      createdBy: ctx.userId,
    });

    contract.pendingBilling += input.amount;
    await contract.save();
    await this.syncAlerts(tenderId);

    await this.log(tenderId, ctx, 'invoice_added', `Billing record: ${input.description}`, {
      contractId: String(contract._id),
      newValue: { amount: input.amount },
    });

    return { id: String(entry._id), amount: entry.amount };
  }

  async approveBilling(billingId: string, ctx: RequestContext, approved: boolean) {
    const entry = await PostAwardBilling.findById(billingId);
    if (!entry) throw new AppError('Billing record not found', 404);

    entry.approvalStatus = approved ? 'approved' : 'rejected';
    entry.status = approved ? 'approved' : entry.status;
    if (approved) entry.approvedBy = ctx.userId;
    await entry.save();

    await this.log(String(entry.tenderId), ctx, 'billing_approval', `Billing ${approved ? 'approved' : 'rejected'}`, {
      contractId: String(entry.contractId),
    });

    return { id: String(entry._id), approvalStatus: entry.approvalStatus };
  }

  async uploadDocument(
    tenderId: string,
    ctx: RequestContext,
    file: Express.Multer.File,
    documentType: string,
    documentNumber?: string
  ) {
    const contract = await PostAwardContract.findOne({ tenderId });
    if (!contract) throw new AppError('Post-award contract not found', 404);

    const stored = await fileStorageService.saveFile(
      file.buffer,
      file.originalname,
      postAwardFolder(tenderId)
    );

    const doc = await PostAwardDocument.create({
      contractId: contract._id,
      tenderId: contract.tenderId,
      documentType,
      fileName: stored.fileName,
      originalName: file.originalname,
      localPath: stored.relativePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      documentNumber,
      uploadedBy: ctx.userId,
    });

    if (documentType === 'work_order' && documentNumber) contract.workOrderNumber = documentNumber;
    if (documentType === 'agreement' && documentNumber) contract.agreementNumber = documentNumber;
    if (documentType === 'purchase_order' && documentNumber) contract.purchaseOrderNumber = documentNumber;
    await contract.save();

    const action =
      documentType === 'work_order'
        ? 'work_order_created'
        : documentType === 'agreement'
          ? 'agreement_uploaded'
          : 'document_uploaded';

    await this.log(tenderId, ctx, action, `Uploaded ${documentType}: ${file.originalname}`, {
      contractId: String(contract._id),
    });

    return { id: String(doc._id), originalName: doc.originalName };
  }

  async getDocumentFile(tenderId: string, documentId: string) {
    const doc = await PostAwardDocument.findOne({
      _id: new Types.ObjectId(documentId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!doc) throw new AppError('Document not found', 404);
    const buffer = await fs.readFile(fileStorageService.getAbsolutePath(doc.localPath));
    return { buffer, record: doc };
  }

  async deleteRecord(
    tenderId: string,
    ctx: RequestContext,
    type: 'revenue' | 'billing' | 'document',
    recordId: string
  ) {
    if (ctx.userRole !== UserRole.MD) {
      throw new AppError('Admin access required to delete records', 403);
    }

    const contract = await PostAwardContract.findOne({ tenderId });
    if (!contract) throw new AppError('Contract not found', 404);

    if (type === 'revenue') {
      const entry = await PostAwardRevenue.findOneAndDelete({ _id: recordId, tenderId });
      if (!entry) throw new AppError('Revenue entry not found', 404);
      contract.totalRevenue = Math.max(0, contract.totalRevenue - entry.amount);
      await contract.save();
    } else if (type === 'billing') {
      await PostAwardBilling.findOneAndDelete({ _id: recordId, tenderId });
    } else {
      const doc = await PostAwardDocument.findOneAndDelete({ _id: recordId, tenderId });
      if (doc) await fileStorageService.deleteFile(doc.localPath);
    }

    await this.log(tenderId, ctx, 'record_deleted', `Deleted ${type} record`, { contractId: String(contract._id) });
    return { deleted: true };
  }

  async syncAlerts(tenderId?: string) {
    await this.ensureAlertRules();
    const rules = await PostAwardAlertRule.find({ enabled: true }).lean();
    const filter: FilterQuery<IPostAwardContract> = tenderId
      ? { tenderId: new Types.ObjectId(tenderId) }
      : {};
    const contracts = await PostAwardContract.find(filter).lean();
    const activeKeys = new Set<string>();

    for (const contract of contracts) {
      const checks: Array<{
        type: PostAwardAlertDto['alertType'];
        date?: Date;
        label: string;
      }> = [
        { type: 'contract_expiry', date: contract.contractEndDate, label: 'Contract' },
        { type: 'amc_expiry', date: contract.amcEndDate, label: 'AMC' },
        { type: 'agreement_expiry', date: contract.agreementExpiryDate, label: 'Agreement' },
      ];

      for (const check of checks) {
        if (!check.date) continue;
        const remaining = daysUntil(check.date);
        for (const rule of rules.filter((r) => r.alertType === check.type)) {
          const matches =
            rule.daysBeforeExpiry === 0
              ? remaining < 0
              : remaining >= 0 && remaining <= rule.daysBeforeExpiry;
          if (!matches) continue;

          const key = `${String(contract._id)}:${check.type}:${rule.daysBeforeExpiry}`;
          activeKeys.add(key);
          const message =
            remaining < 0
              ? `${check.label} expired for ${contract.clientName}`
              : `${check.label} expires in ${remaining} days — ${contract.tenderTitle}`;

          await PostAwardAlert.findOneAndUpdate(
            {
              contractId: contract._id,
              alertType: check.type,
              dueDate: check.date,
            },
            {
              $set: {
                tenderId: contract.tenderId,
                priority: rule.priority,
                title: `${check.label} alert`,
                message,
                isDismissed: false,
              },
            },
            { upsert: true }
          );
          break;
        }
      }

      if (contract.revenuePending > 0) {
        const overdue = await PostAwardRevenue.findOne({
          contractId: contract._id,
          status: 'overdue',
          approvalStatus: 'approved',
        });
        if (overdue) {
          activeKeys.add(`${String(contract._id)}:revenue_delay`);
          await PostAwardAlert.findOneAndUpdate(
            { contractId: contract._id, alertType: 'revenue_delay' },
            {
              $set: {
                tenderId: contract.tenderId,
                priority: 'medium',
                title: 'Revenue collection delay',
                message: `Pending revenue ₹${contract.revenuePending.toLocaleString('en-IN')} for ${contract.clientName}`,
                isDismissed: false,
              },
            },
            { upsert: true }
          );
        }
      }

      if (contract.pendingBilling > 0) {
        activeKeys.add(`${String(contract._id)}:pending_billing`);
        await PostAwardAlert.findOneAndUpdate(
          { contractId: contract._id, alertType: 'pending_billing' },
          {
            $set: {
              tenderId: contract.tenderId,
              priority: 'medium',
              title: 'Pending billing',
              message: `₹${contract.pendingBilling.toLocaleString('en-IN')} billing pending for ${contract.clientName}`,
              isDismissed: false,
            },
          },
          { upsert: true }
        );
      }
    }
  }

  async isPostAwardAvailable(tenderId: string): Promise<boolean> {
    const tender = await Tender.findById(tenderId).select('status').lean();
    return tender?.status === TenderStatus.AWARDED;
  }
}

export const postAwardService = new PostAwardService();
