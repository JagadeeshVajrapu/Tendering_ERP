import fs from 'fs/promises';
import { FilterQuery, Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { FinanceRecord, IFinanceRecord } from '../../models/FinanceRecord';
import { FinanceDocument } from '../../models/FinanceDocument';
import { RefundRecord } from '../../models/RefundRecord';
import { FinanceAlert } from '../../models/FinanceAlert';
import { FinanceLog } from '../../models/FinanceLog';
import { UserRole } from '../../types';
import {
  CreateFinanceRecordInput,
  FinanceAlertDto,
  FinanceAlertLevel,
  FinanceDashboardDto,
  FinanceDocumentDto,
  FinanceLogDto,
  FinanceRecordDto,
  FinanceRecordListQuery,
  FinanceRecordType,
  FinanceSummaryDto,
  RefundRecordDto,
  RefundReportItemDto,
  RefundStatus,
  UpdateFinanceRecordInput,
  UpdateRefundStatusInput,
} from '../../types/financeTracking';
import { fileStorageService } from '../storage/fileStorageService';
import { auditService } from '../audit/auditService';

const EXPIRY_THRESHOLDS: Array<{ level: FinanceAlertLevel; days: number }> = [
  { level: '30_days', days: 30 },
  { level: '15_days', days: 15 },
  { level: '7_days', days: 7 },
  { level: 'expired', days: 0 },
];

function financeFolder(tenderId: string): string {
  return `finance/${tenderId}`;
}

interface RequestContext {
  userId: Types.ObjectId;
  userRole: UserRole;
  userName: string;
  ipAddress?: string;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function defaultStatus(recordType: FinanceRecordType): string {
  switch (recordType) {
    case 'BG':
    case 'PBG':
      return 'Active';
    case 'DD':
      return 'Issued';
    case 'TENDER_FEE':
      return 'Pending';
    case 'SECURITY_DEPOSIT':
      return 'Active';
    case 'EMD':
      return 'Paid';
    default:
      return 'Active';
  }
}

function parseDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function resolveBgPbgStatus(expiryDate?: Date, currentStatus?: string): string {
  if (currentStatus === 'Released') return 'Released';
  if (!expiryDate) return currentStatus || 'Active';
  const remaining = daysUntil(expiryDate);
  if (remaining < 0) return 'Expired';
  if (remaining <= 30) return 'Expiring Soon';
  return 'Active';
}

function recordLabel(record: IFinanceRecord): string {
  if (record.instrumentNumber) return record.instrumentNumber;
  if (record.referenceNumber) return record.referenceNumber;
  return record.recordType;
}

class FinanceTrackingService {
  private async assertTender(tenderId: string) {
    const tender = await Tender.findById(tenderId).select('title').lean();
    if (!tender) throw new AppError('Tender not found', 404);
    return tender;
  }

  private async logAction(
    tenderId: string,
    ctx: RequestContext,
    action: string,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    await FinanceLog.create({
      tenderId: new Types.ObjectId(tenderId),
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: ctx.userRole,
      action,
      message,
      metadata,
      ipAddress: ctx.ipAddress,
    });

    await auditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action,
      entityType: 'finance_tracking',
      entityId: tenderId,
      ipAddress: ctx.ipAddress,
      metadata: { tenderId, ...metadata },
    });
  }

  private mapRecord(record: IFinanceRecord, createdByName?: string): FinanceRecordDto {
    const status =
      record.recordType === 'BG' || record.recordType === 'PBG'
        ? resolveBgPbgStatus(record.expiryDate, record.status)
        : record.status;

    return {
      id: String(record._id),
      tenderId: String(record.tenderId),
      recordType: record.recordType,
      amount: record.amount,
      bankName: record.bankName,
      referenceNumber: record.referenceNumber,
      issueDate: record.issueDate?.toISOString(),
      expiryDate: record.expiryDate?.toISOString(),
      status,
      remarks: record.remarks,
      createdBy: String(record.createdBy),
      createdByName,
      createdAt: record.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: record.updatedAt?.toISOString(),
      paymentDate: record.paymentDate?.toISOString(),
      paymentMode: record.paymentMode,
      transactionReferenceNumber: record.transactionReferenceNumber,
      refundStatus: record.refundStatus,
      instrumentNumber: record.instrumentNumber,
      depositDate: record.depositDate?.toISOString(),
    };
  }

  private mapRefund(refund: {
    _id: Types.ObjectId;
    tenderId: Types.ObjectId;
    financeRecordId: Types.ObjectId;
    instrumentType: FinanceRecordType;
    instrumentLabel: string;
    amount: number;
    status: RefundStatus;
    requestDate?: Date;
    approvalDate?: Date;
    receivedDate?: Date;
    history: Array<{
      status: RefundStatus;
      date: Date;
      updatedByName?: string;
      note?: string;
    }>;
    createdAt?: Date;
  }): RefundRecordDto {
    const pendingSince =
      refund.requestDate?.toISOString() ||
      refund.history[0]?.date?.toISOString() ||
      refund.createdAt?.toISOString();

    return {
      id: String(refund._id),
      tenderId: String(refund.tenderId),
      financeRecordId: String(refund.financeRecordId),
      instrumentType: refund.instrumentType,
      instrumentLabel: refund.instrumentLabel,
      amount: refund.amount,
      status: refund.status,
      requestDate: refund.requestDate?.toISOString(),
      approvalDate: refund.approvalDate?.toISOString(),
      receivedDate: refund.receivedDate?.toISOString(),
      pendingSince,
      history: refund.history.map((h) => ({
        status: h.status,
        date: h.date.toISOString(),
        updatedByName: h.updatedByName,
        note: h.note,
      })),
    };
  }

  private async syncExpiryAlerts(tenderId: string, records: IFinanceRecord[]) {
    const guaranteeRecords = records.filter(
      (r) => (r.recordType === 'BG' || r.recordType === 'PBG') && r.expiryDate && r.status !== 'Released'
    );

    const activeKeys = new Set<string>();

    for (const record of guaranteeRecords) {
      const expiryDate = record.expiryDate!;
      const remaining = daysUntil(expiryDate);
      const instrumentNumber = record.instrumentNumber || record.referenceNumber || record.recordType;
      const prefix = record.recordType === 'BG' ? 'BG' : 'PBG';

      for (const threshold of EXPIRY_THRESHOLDS) {
        const matches =
          threshold.level === 'expired'
            ? remaining < 0
            : remaining >= 0 && remaining <= threshold.days;

        if (!matches) continue;

        const key = `${String(record._id)}:${threshold.level}`;
        activeKeys.add(key);

        const message =
          threshold.level === 'expired'
            ? `${prefix} No. ${instrumentNumber} has expired`
            : `${prefix} No. ${instrumentNumber} expires in ${remaining} day${remaining === 1 ? '' : 's'}`;

        await FinanceAlert.findOneAndUpdate(
          {
            tenderId: new Types.ObjectId(tenderId),
            financeRecordId: record._id,
            alertLevel: threshold.level,
          },
          {
            $set: {
              recordType: record.recordType as 'BG' | 'PBG',
              instrumentNumber,
              message,
              daysUntilExpiry: remaining,
              expiryDate,
            },
          },
          { upsert: true, new: true }
        );
        break;
      }
    }

    const existingAlerts = await FinanceAlert.find({ tenderId: new Types.ObjectId(tenderId) }).lean();
    for (const alert of existingAlerts) {
      const key = `${String(alert.financeRecordId)}:${alert.alertLevel}`;
      if (!activeKeys.has(key)) {
        await FinanceAlert.deleteOne({ _id: alert._id });
      }
    }
  }

  private computeSummary(records: IFinanceRecord[], refunds: RefundRecordDto[]): FinanceSummaryDto {
    const sumByType = (type: FinanceRecordType) =>
      records.filter((r) => r.recordType === type).reduce((sum, r) => sum + r.amount, 0);

    const pendingRefundAmount = refunds
      .filter((r) => r.status !== 'received')
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      emdAmount: sumByType('EMD'),
      bgAmount: sumByType('BG'),
      ddAmount: sumByType('DD'),
      tenderFeeAmount: sumByType('TENDER_FEE'),
      securityDepositAmount: sumByType('SECURITY_DEPOSIT'),
      pbgAmount: sumByType('PBG'),
      pendingRefundAmount,
    };
  }

  private async maybeCreateRefundRecord(
    tenderId: string,
    record: IFinanceRecord,
    ctx: RequestContext
  ) {
    const refundable: FinanceRecordType[] = ['EMD', 'SECURITY_DEPOSIT', 'PBG'];
    if (!refundable.includes(record.recordType)) return;

    const existing = await RefundRecord.findOne({
      tenderId: new Types.ObjectId(tenderId),
      financeRecordId: record._id,
    });
    if (existing) return;

    const label = recordLabel(record);
    await RefundRecord.create({
      tenderId: new Types.ObjectId(tenderId),
      financeRecordId: record._id,
      instrumentType: record.recordType,
      instrumentLabel: label,
      amount: record.amount,
      status: record.refundStatus || 'pending',
      history: [
        {
          status: (record.refundStatus || 'pending') as RefundStatus,
          date: new Date(),
          updatedBy: ctx.userId,
          updatedByName: ctx.userName,
          note: 'Refund tracking initialized',
        },
      ],
    });
  }

  async getDashboard(
    tenderId: string,
    ctx: RequestContext,
    query: FinanceRecordListQuery = {}
  ): Promise<FinanceDashboardDto> {
    const tender = await this.assertTender(tenderId);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const allRecords = await FinanceRecord.find({ tenderId: new Types.ObjectId(tenderId) }).lean();
    await this.syncExpiryAlerts(tenderId, allRecords as unknown as IFinanceRecord[]);

    const filter: FilterQuery<IFinanceRecord> = { tenderId: new Types.ObjectId(tenderId) };
    if (query.recordType) filter.recordType = query.recordType;
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { bankName: { $regex: term, $options: 'i' } },
        { referenceNumber: { $regex: term, $options: 'i' } },
        { instrumentNumber: { $regex: term, $options: 'i' } },
        { remarks: { $regex: term, $options: 'i' } },
      ];
    }

    const total = await FinanceRecord.countDocuments(filter);
    const records = await FinanceRecord.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name')
      .lean();

    const refunds = await RefundRecord.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ updatedAt: -1 })
      .lean();
    const refundDtos = refunds.map((r) => this.mapRefund(r));

    const alerts = await FinanceAlert.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ daysUntilExpiry: 1, createdAt: -1 })
      .lean();

    const documents = await FinanceDocument.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name')
      .lean();

    const logs = await FinanceLog.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const refundReportItems: RefundReportItemDto[] = refundDtos
      .filter((r) => r.status !== 'received')
      .map((r) => ({
        tenderId,
        tenderName: tender.title,
        instrumentType: r.instrumentType,
        instrumentLabel: r.instrumentLabel,
        amount: r.amount,
        pendingSince: r.pendingSince || r.requestDate || new Date().toISOString(),
        currentStatus: r.status,
      }));

    return {
      tenderId,
      tenderName: tender.title,
      summary: this.computeSummary(allRecords as unknown as IFinanceRecord[], refundDtos),
      records: {
        items: records.map((r) =>
          this.mapRecord(r as unknown as IFinanceRecord, (r.createdBy as { name?: string })?.name)
        ),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      refunds: refundDtos,
      refundReport: {
        items: refundReportItems,
        totalPendingAmount: refundReportItems.reduce((sum, r) => sum + r.amount, 0),
      },
      alerts: alerts.map((a) => ({
        id: String(a._id),
        tenderId: String(a.tenderId),
        financeRecordId: String(a.financeRecordId),
        recordType: a.recordType,
        instrumentNumber: a.instrumentNumber,
        alertLevel: a.alertLevel,
        message: a.message,
        daysUntilExpiry: a.daysUntilExpiry,
        expiryDate: a.expiryDate.toISOString(),
        createdAt: a.createdAt?.toISOString() || new Date().toISOString(),
      })),
      documents: documents.map((d) => ({
        id: String(d._id),
        tenderId: String(d.tenderId),
        financeRecordId: d.financeRecordId ? String(d.financeRecordId) : undefined,
        documentType: d.documentType,
        fileName: d.fileName,
        originalName: d.originalName,
        mimeType: d.mimeType,
        uploadedBy: String(d.uploadedBy),
        uploadedByName: (d.uploadedBy as { name?: string })?.name,
        uploadedAt: d.createdAt?.toISOString() || new Date().toISOString(),
      })),
      activityLog: logs.map((l) => ({
        id: String(l._id),
        tenderId: String(l.tenderId),
        userId: String(l.userId),
        userName: l.userName,
        userRole: l.userRole,
        action: l.action,
        message: l.message,
        metadata: l.metadata,
        createdAt: l.createdAt?.toISOString() || new Date().toISOString(),
      })),
    };
  }

  async createRecord(tenderId: string, ctx: RequestContext, input: CreateFinanceRecordInput) {
    await this.assertTender(tenderId);
    if (!input.recordType) throw new AppError('Record type is required', 400);
    if (input.amount == null || input.amount < 0) throw new AppError('Valid amount is required', 400);

    const status = input.status || defaultStatus(input.recordType);
    const record = await FinanceRecord.create({
      tenderId: new Types.ObjectId(tenderId),
      recordType: input.recordType,
      amount: input.amount,
      bankName: input.bankName,
      referenceNumber: input.referenceNumber,
      issueDate: parseDate(input.issueDate),
      expiryDate: parseDate(input.expiryDate),
      status:
        input.recordType === 'BG' || input.recordType === 'PBG'
          ? resolveBgPbgStatus(parseDate(input.expiryDate), status)
          : status,
      remarks: input.remarks,
      createdBy: ctx.userId,
      paymentDate: parseDate(input.paymentDate),
      paymentMode: input.paymentMode,
      transactionReferenceNumber: input.transactionReferenceNumber || input.referenceNumber,
      refundStatus: input.recordType === 'EMD' ? ('pending' as RefundStatus) : undefined,
      instrumentNumber: input.instrumentNumber,
      depositDate: parseDate(input.depositDate),
    });

    await this.maybeCreateRefundRecord(tenderId, record, ctx);
    await this.syncExpiryAlerts(tenderId, [record]);

    await this.logAction(tenderId, ctx, 'record_created', `Created ${input.recordType} record`, {
      recordId: String(record._id),
      amount: input.amount,
    });

    return this.mapRecord(record);
  }

  async updateRecord(
    tenderId: string,
    recordId: string,
    ctx: RequestContext,
    input: UpdateFinanceRecordInput
  ) {
    await this.assertTender(tenderId);
    const record = await FinanceRecord.findOne({
      _id: new Types.ObjectId(recordId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!record) throw new AppError('Finance record not found', 404);

    if (input.amount != null) record.amount = input.amount;
    if (input.bankName !== undefined) record.bankName = input.bankName;
    if (input.referenceNumber !== undefined) record.referenceNumber = input.referenceNumber;
    if (input.issueDate !== undefined) record.issueDate = parseDate(input.issueDate);
    if (input.expiryDate !== undefined) record.expiryDate = parseDate(input.expiryDate);
    if (input.remarks !== undefined) record.remarks = input.remarks;
    if (input.paymentDate !== undefined) record.paymentDate = parseDate(input.paymentDate);
    if (input.paymentMode !== undefined) record.paymentMode = input.paymentMode;
    if (input.transactionReferenceNumber !== undefined) {
      record.transactionReferenceNumber = input.transactionReferenceNumber;
    }
    if (input.instrumentNumber !== undefined) record.instrumentNumber = input.instrumentNumber;
    if (input.depositDate !== undefined) record.depositDate = parseDate(input.depositDate);
    if (input.status !== undefined) record.status = input.status;

    if (record.recordType === 'BG' || record.recordType === 'PBG') {
      record.status = resolveBgPbgStatus(record.expiryDate, record.status);
    } else if (input.status) {
      record.status = input.status;
    }

    await record.save();
    await this.syncExpiryAlerts(tenderId, [record]);

    const refund = await RefundRecord.findOne({ financeRecordId: record._id });
    if (refund && input.amount != null) {
      refund.amount = input.amount;
      refund.instrumentLabel = recordLabel(record);
      await refund.save();
    }

    await this.logAction(tenderId, ctx, 'record_updated', `Updated ${record.recordType} record`, {
      recordId,
    });

    return this.mapRecord(record);
  }

  async deleteRecord(tenderId: string, recordId: string, ctx: RequestContext) {
    await this.assertTender(tenderId);
    const record = await FinanceRecord.findOne({
      _id: new Types.ObjectId(recordId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!record) throw new AppError('Finance record not found', 404);

    const docs = await FinanceDocument.find({ financeRecordId: record._id });
    for (const doc of docs) {
      await fileStorageService.deleteFile(doc.localPath);
      await doc.deleteOne();
    }

    await RefundRecord.deleteMany({ financeRecordId: record._id });
    await FinanceAlert.deleteMany({ financeRecordId: record._id });
    await record.deleteOne();

    await this.logAction(tenderId, ctx, 'record_deleted', `Deleted ${record.recordType} record`, {
      recordId,
    });
  }

  async uploadDocument(
    tenderId: string,
    ctx: RequestContext,
    file: Express.Multer.File,
    documentType: string,
    financeRecordId?: string
  ) {
    await this.assertTender(tenderId);
    if (!documentType) throw new AppError('Document type is required', 400);

    if (financeRecordId) {
      const record = await FinanceRecord.findOne({
        _id: new Types.ObjectId(financeRecordId),
        tenderId: new Types.ObjectId(tenderId),
      });
      if (!record) throw new AppError('Finance record not found', 404);
    }

    const stored = await fileStorageService.saveFile(
      file.buffer,
      file.originalname,
      financeFolder(tenderId)
    );

    const doc = await FinanceDocument.create({
      tenderId: new Types.ObjectId(tenderId),
      financeRecordId: financeRecordId ? new Types.ObjectId(financeRecordId) : undefined,
      documentType,
      fileName: stored.fileName,
      originalName: file.originalname,
      localPath: stored.relativePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedBy: ctx.userId,
    });

    await this.logAction(tenderId, ctx, 'document_uploaded', `Uploaded ${documentType}`, {
      documentId: String(doc._id),
      fileName: file.originalname,
    });

    return {
      id: String(doc._id),
      tenderId,
      financeRecordId,
      documentType: doc.documentType,
      fileName: doc.fileName,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      uploadedBy: String(doc.uploadedBy),
      uploadedAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    } satisfies FinanceDocumentDto;
  }

  async listDocuments(tenderId: string): Promise<FinanceDocumentDto[]> {
    await this.assertTender(tenderId);
    const documents = await FinanceDocument.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name')
      .lean();

    return documents.map((d) => ({
      id: String(d._id),
      tenderId: String(d.tenderId),
      financeRecordId: d.financeRecordId ? String(d.financeRecordId) : undefined,
      documentType: d.documentType,
      fileName: d.fileName,
      originalName: d.originalName,
      mimeType: d.mimeType,
      uploadedBy: String(d.uploadedBy),
      uploadedByName: (d.uploadedBy as { name?: string })?.name,
      uploadedAt: d.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getDocumentFile(tenderId: string, documentId: string) {
    const doc = await FinanceDocument.findOne({
      _id: new Types.ObjectId(documentId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!doc) throw new AppError('Document not found', 404);

    const buffer = await fs.readFile(fileStorageService.getAbsolutePath(doc.localPath));
    return { buffer, record: doc };
  }

  async deleteDocument(tenderId: string, documentId: string, ctx: RequestContext) {
    const doc = await FinanceDocument.findOne({
      _id: new Types.ObjectId(documentId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!doc) throw new AppError('Document not found', 404);

    await fileStorageService.deleteFile(doc.localPath);
    await doc.deleteOne();

    await this.logAction(tenderId, ctx, 'document_deleted', `Deleted ${doc.documentType}`, {
      documentId,
      fileName: doc.originalName,
    });
  }

  async updateRefundStatus(tenderId: string, ctx: RequestContext, input: UpdateRefundStatusInput) {
    await this.assertTender(tenderId);
    if (!input.status) throw new AppError('Refund status is required', 400);

    let refund = input.refundRecordId
      ? await RefundRecord.findOne({
          _id: new Types.ObjectId(input.refundRecordId),
          tenderId: new Types.ObjectId(tenderId),
        })
      : null;

    if (!refund && input.financeRecordId) {
      refund = await RefundRecord.findOne({
        financeRecordId: new Types.ObjectId(input.financeRecordId),
        tenderId: new Types.ObjectId(tenderId),
      });
    }

    if (!refund) throw new AppError('Refund record not found', 404);

    const now = new Date();
    refund.status = input.status;
    if (input.status === 'requested') {
      refund.requestDate = parseDate(input.requestDate) || refund.requestDate || now;
    }
    if (input.status === 'approved') {
      refund.approvalDate = parseDate(input.approvalDate) || refund.approvalDate || now;
    }
    if (input.status === 'received') {
      refund.receivedDate = parseDate(input.receivedDate) || refund.receivedDate || now;
    }

    refund.history.push({
      status: input.status,
      date: now,
      updatedBy: ctx.userId,
      updatedByName: ctx.userName,
      note: input.note,
    });

    await refund.save();

    const financeRecord = await FinanceRecord.findById(refund.financeRecordId);
    if (financeRecord) {
      if (financeRecord.recordType === 'EMD') {
        financeRecord.refundStatus = input.status;
        await financeRecord.save();
      }
      if (financeRecord.recordType === 'SECURITY_DEPOSIT') {
        if (input.status === 'received') financeRecord.status = 'Refunded';
        else if (input.status !== 'pending') financeRecord.status = 'Refund Pending';
        await financeRecord.save();
      }
      if (financeRecord.recordType === 'PBG' && input.status === 'received') {
        financeRecord.status = 'Released';
        await financeRecord.save();
        await this.syncExpiryAlerts(tenderId, [financeRecord]);
      }
    }

    await this.logAction(tenderId, ctx, 'refund_status_updated', `Refund status set to ${input.status}`, {
      refundRecordId: String(refund._id),
      status: input.status,
    });

    return this.mapRefund(refund);
  }

  async getRefundReport(tenderId: string) {
    const dashboard = await this.getDashboard(tenderId, {
      userId: new Types.ObjectId(),
      userRole: UserRole.EXECUTIVE,
      userName: 'System',
    });
    return dashboard.refundReport;
  }

  async getAlerts(tenderId: string): Promise<FinanceAlertDto[]> {
    const records = await FinanceRecord.find({ tenderId: new Types.ObjectId(tenderId) }).lean();
    await this.syncExpiryAlerts(tenderId, records as unknown as IFinanceRecord[]);
    const alerts = await FinanceAlert.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ daysUntilExpiry: 1 })
      .lean();
    return alerts.map((a) => ({
      id: String(a._id),
      tenderId: String(a.tenderId),
      financeRecordId: String(a.financeRecordId),
      recordType: a.recordType,
      instrumentNumber: a.instrumentNumber,
      alertLevel: a.alertLevel,
      message: a.message,
      daysUntilExpiry: a.daysUntilExpiry,
      expiryDate: a.expiryDate.toISOString(),
      createdAt: a.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getActivityLog(tenderId: string, limit = 50): Promise<FinanceLogDto[]> {
    await this.assertTender(tenderId);
    const logs = await FinanceLog.find({ tenderId: new Types.ObjectId(tenderId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return logs.map((l) => ({
      id: String(l._id),
      tenderId: String(l.tenderId),
      userId: String(l.userId),
      userName: l.userName,
      userRole: l.userRole,
      action: l.action,
      message: l.message,
      metadata: l.metadata,
      createdAt: l.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }
}

export const financeTrackingService = new FinanceTrackingService();
