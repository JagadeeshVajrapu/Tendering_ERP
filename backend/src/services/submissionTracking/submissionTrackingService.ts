import fs from 'fs/promises';
import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { PreparationDocument } from '../../models/PreparationDocument';
import { PreparationDocumentValidation } from '../../models/PreparationDocumentValidation';
import { TenderSubmissionTracking } from '../../models/TenderSubmissionTracking';
import { TenderSubmissionScreenshot } from '../../models/TenderSubmissionScreenshot';
import { TenderSubmissionLog } from '../../models/TenderSubmissionLog';
import { User } from '../../models/User';
import { UserRole, NotificationType } from '../../types';
import {
  SubmissionDeadlineAlertLevel,
  SubmissionDeadlineDto,
  SubmissionLogDto,
  SubmissionScreenshotDto,
  SubmissionTrackingDashboardDto,
  SubmissionTrackingStatus,
} from '../../types/submissionTracking';
import { dynamicChecklistService } from '../dynamicChecklist/dynamicChecklistService';
import { enterpriseMasterDatasetAccess } from '../masterTenderDataset/enterpriseMasterDatasetAccess';
import { fileStorageService } from '../storage/fileStorageService';
import { auditService } from '../audit/auditService';
import { notificationService } from '../notification/notificationService';
import { assertSubmissionWritable } from './submissionLockGuard';

const ALERT_THRESHOLDS: Array<{ level: SubmissionDeadlineAlertLevel; ms: number; message: string }> = [
  { level: '7_days', ms: 7 * 24 * 60 * 60 * 1000, message: '7 days remaining until submission deadline' },
  { level: '3_days', ms: 3 * 24 * 60 * 60 * 1000, message: '3 days remaining until submission deadline' },
  { level: '24_hours', ms: 24 * 60 * 60 * 1000, message: '24 hours remaining until submission deadline' },
  { level: '6_hours', ms: 6 * 60 * 60 * 1000, message: '6 hours remaining until submission deadline' },
  { level: '1_hour', ms: 60 * 60 * 1000, message: '1 hour remaining until submission deadline' },
];

function submissionFolder(tenderId: string): string {
  return `submission/${tenderId}`;
}

interface RequestContext {
  userId: Types.ObjectId;
  userRole: UserRole;
  userName: string;
  ipAddress?: string;
}

class SubmissionTrackingService {
  private async logAction(
    tenderId: string,
    ctx: RequestContext,
    action: string,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    await TenderSubmissionLog.create({
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
      entityType: 'submission_tracking',
      entityId: tenderId,
      ipAddress: ctx.ipAddress,
      metadata: { tenderId, ...metadata },
    });
  }

  private parseDeadline(value?: string): Date | undefined {
    if (!value?.trim()) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private async resolveDeadline(tenderId: string, documentId?: Types.ObjectId) {
    if (!documentId) return { deadlineAt: undefined, deadlineLabel: undefined };
    try {
      const params = await enterpriseMasterDatasetAccess.getParameters(documentId, new Types.ObjectId(tenderId), {
        refresh: false,
      });
      const bidEnd = params.find((p) =>
        /bid submission|submission end|closing date|last date|bid end/i.test(
          `${p.parameter} ${p.normalizedParameter}`
        )
      );
      const label = bidEnd?.value?.trim();
      return { deadlineAt: this.parseDeadline(label), deadlineLabel: label };
    } catch {
      return { deadlineAt: undefined, deadlineLabel: undefined };
    }
  }

  private computeDeadlineDto(deadlineAt?: Date, deadlineLabel?: string): SubmissionDeadlineDto {
    if (!deadlineAt) {
      return { alertLevel: 'none', deadlineLabel };
    }

    const remainingMs = deadlineAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      return {
        deadlineAt: deadlineAt.toISOString(),
        deadlineLabel,
        remainingMs: 0,
        remainingLabel: 'Deadline passed',
        alertLevel: 'expired',
        alertMessage: 'Submission deadline has passed',
      };
    }

    let alertLevel: SubmissionDeadlineAlertLevel = 'none';
    let alertMessage: string | undefined;
    for (const threshold of ALERT_THRESHOLDS) {
      if (remainingMs <= threshold.ms) {
        alertLevel = threshold.level;
        alertMessage = threshold.message;
        break;
      }
    }

    const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    let remainingLabel = '';
    if (days > 0) remainingLabel = `${days}d ${hours}h remaining`;
    else if (hours > 0) remainingLabel = `${hours}h ${minutes}m remaining`;
    else remainingLabel = `${minutes}m remaining`;

    return {
      deadlineAt: deadlineAt.toISOString(),
      deadlineLabel,
      remainingMs,
      remainingLabel,
      alertLevel,
      alertMessage,
    };
  }

  private async loadChecklist(tenderId: string) {
    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) {
      return {
        items: [] as SubmissionTrackingDashboardDto['checklistItems'],
        summary: { required: 0, completed: 0, missing: 0, criticalMissing: 0 },
        readinessLabel: 'No NIT document',
        completionPercentage: 0,
        mandatoryComplete: false,
        documentId: undefined as Types.ObjectId | undefined,
      };
    }

    const checklist = await dynamicChecklistService.getChecklist(String(document._id), false);
    const items = checklist.categories.flatMap((cat) =>
      cat.items
        .filter((item) => item.required && !item.optional)
        .filter(
          (item) =>
            item.itemType !== 'selection_header' &&
            item.itemType !== 'compliance_header' &&
            item.itemType !== 'experience_header'
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          categoryTitle: cat.title,
          required: true,
          uploaded: item.uploaded || item.markedComplete === true,
          missing: item.missing && !item.markedComplete,
          critical: item.critical,
          status: item.displayStatus,
          matchedFileName: item.matchedFileName,
        }))
    );

    const completed = items.filter((item) => item.uploaded && !item.missing).length;
    const missing = items.filter((item) => item.missing).length;
    const criticalMissing = items.filter((item) => item.critical && item.missing).length;
    const required = items.length;
    const completionPercentage =
      required > 0 ? Math.round((completed / required) * 100) : 0;
    const mandatoryComplete = required > 0 && missing === 0 && criticalMissing === 0;

    return {
      items,
      summary: {
        required,
        completed,
        missing,
        criticalMissing,
      },
      readinessLabel:
        mandatoryComplete
          ? 'Ready for submission'
          : missing > 0
            ? `${missing} required document(s) pending`
            : checklist.summary.readinessLabel,
      completionPercentage,
      mandatoryComplete,
      documentId: document._id,
      checklistSnapshot: checklist.summary,
    };
  }

  private async loadDocumentSummary(tenderId: string) {
    const [prepDocs, validations] = await Promise.all([
      PreparationDocument.find({ tenderId: new Types.ObjectId(tenderId) }).lean(),
      PreparationDocumentValidation.find({ tenderId: new Types.ObjectId(tenderId) }).lean(),
    ]);

    return {
      preparationDocumentCount: prepDocs.length,
      preparationTotalSize: prepDocs.reduce((s, d) => s + (d.fileSize || 0), 0),
      validationComplete: validations.filter((v) => v.status === 'valid').length,
      validationWarning: validations.filter((v) => v.status === 'warning').length,
      validationError: validations.filter((v) => v.status === 'error').length,
    };
  }

  private toScreenshotDto(
    record: InstanceType<typeof TenderSubmissionScreenshot>,
    tenderId: string
  ): SubmissionScreenshotDto {
    const base = `/api/tenders/${tenderId}/submission-tracking/screenshots/${String(record._id)}`;
    return {
      id: String(record._id),
      tenderId,
      fileName: record.fileName,
      originalName: record.originalName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      caption: record.caption,
      downloadUrl: `${base}/download`,
      previewUrl: `${base}/preview`,
      uploadedBy: { id: String(record.uploadedBy), name: '' },
      uploadedAt: record.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  private async maybeSendDeadlineAlert(
    tenderId: string,
    tenderTitle: string,
    tracking: InstanceType<typeof TenderSubmissionTracking>,
    deadline: SubmissionDeadlineDto,
    executiveId?: Types.ObjectId
  ) {
    if (!deadline.alertLevel || deadline.alertLevel === 'none' || !executiveId) return;
    if (tracking.lastAlertLevel === deadline.alertLevel) return;

    await notificationService.notifyUser(
      executiveId,
      NotificationType.SUBMISSION_ALERT,
      `Submission deadline alert — ${tenderTitle}`,
      deadline.alertMessage || deadline.remainingLabel || 'Deadline approaching',
      'submission_tracking',
      new Types.ObjectId(tenderId)
    );

    tracking.lastAlertLevel = deadline.alertLevel;
    tracking.lastAlertAt = new Date();
    await tracking.save();
  }

  async getDashboard(tenderId: string, ctx?: RequestContext): Promise<SubmissionTrackingDashboardDto> {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const [checklist, documents, screenshots] = await Promise.all([
      this.loadChecklist(tenderId),
      this.loadDocumentSummary(tenderId),
      TenderSubmissionScreenshot.find({ tenderId }).sort({ createdAt: -1 }).populate('uploadedBy', 'name'),
    ]);

    let tracking = await TenderSubmissionTracking.findOne({ tenderId });
    const { deadlineAt, deadlineLabel } = await this.resolveDeadline(tenderId, checklist.documentId);

    if (!tracking) {
      tracking = await TenderSubmissionTracking.create({
        tenderId: new Types.ObjectId(tenderId),
        status: checklist.mandatoryComplete ? 'ready' : 'draft',
        completionPercentage: checklist.completionPercentage,
        readinessLabel: checklist.readinessLabel,
        mandatoryComplete: checklist.mandatoryComplete,
        deadlineAt,
        deadlineLabel,
        checklistSnapshot: checklist.checklistSnapshot,
      });
    } else {
      tracking.completionPercentage = checklist.completionPercentage;
      tracking.readinessLabel = checklist.readinessLabel;
      tracking.mandatoryComplete = checklist.mandatoryComplete;
      if (deadlineAt) {
        tracking.deadlineAt = deadlineAt;
        tracking.deadlineLabel = deadlineLabel;
      }
      if (tracking.status === 'draft' && checklist.mandatoryComplete) {
        tracking.status = 'ready';
      }
      tracking.checklistSnapshot = { ...(checklist.checklistSnapshot as object) };
      await tracking.save();
    }

    const deadline = this.computeDeadlineDto(tracking.deadlineAt, tracking.deadlineLabel);
    const activeAlerts = ALERT_THRESHOLDS.filter(
      (t) => deadline.remainingMs !== undefined && deadline.remainingMs <= t.ms && deadline.remainingMs > 0
    ).map((t) => ({ level: t.level, message: t.message }));

    if (ctx && deadline.alertLevel !== 'none') {
      await this.maybeSendDeadlineAlert(
        tenderId,
        tender.title,
        tracking,
        deadline,
        tender.assignedExecutive || tender.createdBy
      );
    }

    const lockReasons: string[] = [];
    if (!checklist.mandatoryComplete) lockReasons.push('Mandatory compliance documents are incomplete');
    if (documents.preparationDocumentCount === 0) lockReasons.push('No preparation documents uploaded');
    if (documents.validationError > 0) lockReasons.push('Document validation errors must be resolved');

    const locked = tracking.status === 'locked' || tracking.status === 'submitted';
    const canLock = tracking.status === 'ready' && lockReasons.length === 0;
    const canSubmit = tracking.status === 'locked';

    let lockedByUser;
    if (tracking.lockedBy) {
      const u = await User.findById(tracking.lockedBy).select('name');
      lockedByUser = u ? { id: String(tracking.lockedBy), name: u.name } : undefined;
    }

    let submittedByUser;
    if (tracking.submittedBy) {
      const u = await User.findById(tracking.submittedBy).select('name');
      submittedByUser = u ? { id: String(tracking.submittedBy), name: u.name } : undefined;
    }

    const screenshotDtos = await Promise.all(
      screenshots.map(async (s) => {
        const dto = this.toScreenshotDto(s, tenderId);
        const uploader = s.uploadedBy as { _id?: Types.ObjectId; name?: string } | Types.ObjectId;
        if (uploader && typeof uploader === 'object' && 'name' in uploader && uploader.name) {
          dto.uploadedBy = { id: String(uploader._id), name: uploader.name };
        }
        return dto;
      })
    );

    return {
      tenderId,
      tenderTitle: tender.title,
      tenderStatus: tender.status,
      submissionStatus: tracking.status,
      completionPercentage: tracking.completionPercentage,
      readinessLabel: tracking.readinessLabel,
      mandatoryComplete: tracking.mandatoryComplete,
      locked,
      lockedAt: tracking.lockedAt?.toISOString(),
      lockedBy: lockedByUser,
      submittedAt: tracking.submittedAt?.toISOString(),
      submittedBy: submittedByUser,
      checklistItems: checklist.items,
      checklistSummary: checklist.summary,
      documents,
      deadline,
      activeAlerts,
      screenshots: screenshotDtos,
      canLock,
      canSubmit,
      lockReasons,
    };
  }

  async markReady(tenderId: string, ctx: RequestContext) {
    await assertSubmissionWritable(tenderId);
    const dashboard = await this.getDashboard(tenderId);
    if (!dashboard.mandatoryComplete) {
      throw new AppError('All mandatory compliance documents must be complete before marking ready', 400);
    }

    const tracking = await TenderSubmissionTracking.findOneAndUpdate(
      { tenderId },
      { status: 'ready' as SubmissionTrackingStatus },
      { new: true, upsert: true }
    );

    await this.logAction(tenderId, ctx, 'submission_marked_ready', 'Tender marked ready for submission', {
      completionPercentage: dashboard.completionPercentage,
    });

    return this.getDashboard(tenderId);
  }

  async verifyAndLock(tenderId: string, ctx: RequestContext) {
    const dashboard = await this.getDashboard(tenderId);
    if (!dashboard.canLock) {
      throw new AppError(
        dashboard.lockReasons.length
          ? `Cannot lock submission: ${dashboard.lockReasons.join('; ')}`
          : 'Submission is not ready to lock',
        400
      );
    }

    const tracking = await TenderSubmissionTracking.findOneAndUpdate(
      { tenderId },
      {
        status: 'locked',
        lockedAt: new Date(),
        lockedBy: ctx.userId,
        checklistSnapshot: dashboard.checklistSummary,
      },
      { new: true, upsert: true }
    );

    await this.logAction(tenderId, ctx, 'submission_locked', 'Submission verified and locked', {
      completionPercentage: dashboard.completionPercentage,
    });

    await notificationService.notifyRole(
      UserRole.MANAGER,
      NotificationType.SUBMISSION_ALERT,
      'Submission locked',
      `"${dashboard.tenderTitle}" submission package has been verified and locked.`,
      'submission_tracking',
      new Types.ObjectId(tenderId)
    );

    return this.getDashboard(tenderId);
  }

  async markSubmitted(tenderId: string, ctx: RequestContext, notes?: string) {
    const dashboard = await this.getDashboard(tenderId);
    if (!dashboard.canSubmit) {
      throw new AppError('Submission must be locked before marking as submitted', 400);
    }

    const screenshots = await TenderSubmissionScreenshot.countDocuments({ tenderId });
    if (screenshots === 0) {
      throw new AppError('Upload at least one submission proof screenshot before marking submitted', 400);
    }

    await TenderSubmissionTracking.findOneAndUpdate(
      { tenderId },
      {
        status: 'submitted',
        submittedAt: new Date(),
        submittedBy: ctx.userId,
        submissionNotes: notes?.trim() || undefined,
      },
      { upsert: true }
    );

    await this.logAction(tenderId, ctx, 'submission_submitted', 'Tender marked as submitted to portal', {
      notes,
      screenshotCount: screenshots,
    });

    await notificationService.notifyRole(
      UserRole.MD,
      NotificationType.SUBMISSION_ALERT,
      'Tender submitted',
      `"${dashboard.tenderTitle}" has been marked as submitted.`,
      'submission_tracking',
      new Types.ObjectId(tenderId)
    );

    return this.getDashboard(tenderId);
  }

  async uploadScreenshot(
    tenderId: string,
    ctx: RequestContext,
    file: Express.Multer.File,
    caption?: string
  ) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const stored = await fileStorageService.saveFile(
      file.buffer,
      file.originalname,
      submissionFolder(tenderId)
    );

    const record = await TenderSubmissionScreenshot.create({
      tenderId: new Types.ObjectId(tenderId),
      fileName: stored.fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.buffer.length,
      localPath: stored.relativePath,
      caption: caption?.trim() || undefined,
      uploadedBy: ctx.userId,
    });

    await this.logAction(tenderId, ctx, 'screenshot_uploaded', `Submission proof uploaded: ${file.originalname}`, {
      screenshotId: String(record._id),
    });

    const populated = await TenderSubmissionScreenshot.findById(record._id).populate('uploadedBy', 'name');
    const dto = this.toScreenshotDto(populated!, tenderId);
    const uploader = populated?.uploadedBy as { _id?: Types.ObjectId; name?: string } | undefined;
    if (uploader?.name) dto.uploadedBy = { id: String(uploader._id), name: uploader.name };

    return dto;
  }

  async getScreenshotFile(tenderId: string, screenshotId: string) {
    const record = await TenderSubmissionScreenshot.findOne({
      _id: screenshotId,
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!record) throw new AppError('Screenshot not found', 404);
    const buffer = await fs.readFile(fileStorageService.getAbsolutePath(record.localPath));
    return { buffer, record };
  }

  async getTimeline(tenderId: string, limit = 50): Promise<SubmissionLogDto[]> {
    const logs = await TenderSubmissionLog.find({ tenderId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return logs.map((log) => ({
      id: String(log._id),
      tenderId,
      userId: String(log.userId),
      userName: log.userName,
      userRole: log.userRole,
      action: log.action,
      message: log.message,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }
}

export const submissionTrackingService = new SubmissionTrackingService();
export { assertSubmissionWritable, isSubmissionLocked } from './submissionLockGuard';
