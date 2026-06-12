import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderDynamicChecklist } from '../../models/TenderDynamicChecklist';
import { DynamicChecklistResult, ChecklistItemWorkflowUpdate } from '../../types/dynamicChecklist';
import { requirementDiscoveryService } from '../requirementDiscovery/requirementDiscoveryService';
import { tenderServiceClassificationService } from '../tenderClassification/tenderServiceClassificationService';
import { enterpriseMasterDatasetAccess } from '../masterTenderDataset/enterpriseMasterDatasetAccess';
import { buildEnterpriseDynamicChecklist, ENTERPRISE_CHECKLIST_SCHEMA_VERSION } from './enterpriseDynamicChecklistEngine';
import { checklistWorkflowService } from './checklistWorkflowService';
import { UserRole } from '../../types';

class DynamicChecklistService {
  async generateAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean; workflowOnly?: boolean }
  ): Promise<DynamicChecklistResult> {
    if (!opts?.refresh) {
      const existing = await TenderDynamicChecklist.findOne({ documentId }).lean();
      if (existing && (existing.schemaVersion ?? 1) >= ENTERPRISE_CHECKLIST_SCHEMA_VERSION) {
        const stored = existing;
        return {
          documentId: String(documentId),
          tenderId: String(tenderId),
          serviceCategory: stored.serviceCategory,
          schemaVersion: stored.schemaVersion ?? 2,
          dataSource: 'enterprise_master_dataset',
          categories: stored.categories,
          summary: stored.summary as DynamicChecklistResult['summary'],
          alerts: stored.alerts || [],
          generatedAt: stored.generatedAt.toISOString(),
        };
      }
    }

    const classification = await tenderServiceClassificationService.classifyAndStore(
      documentId,
      tenderId,
      undefined,
      { refresh: false }
    );

    // Checkbox / workflow updates must not rebuild master dataset — that caused E11000 version races.
    const refreshUpstream = !!opts?.refresh && !opts?.workflowOnly;

    const [requirements, masterParameters, workflowStates] = await Promise.all([
      requirementDiscoveryService.discoverAndStore(documentId, tenderId, {
        refresh: refreshUpstream,
      }),
      enterpriseMasterDatasetAccess.getParameters(documentId, tenderId, {
        refresh: refreshUpstream,
      }),
      checklistWorkflowService.loadStates(documentId),
    ]);

    const result = await buildEnterpriseDynamicChecklist(
      String(documentId),
      String(tenderId),
      classification.serviceCategory,
      requirements,
      masterParameters,
      workflowStates.map((s) => ({
        itemId: s.itemId,
        markedComplete: s.markedComplete,
        markedCompleteAt: s.markedCompleteAt,
        reviewStatus: s.reviewStatus,
        reviewedBy: s.reviewedBy,
        reviewedAt: s.reviewedAt,
        reviewNote: s.reviewNote,
        linkedDocumentId: s.linkedDocumentId,
      }))
    );

    await TenderDynamicChecklist.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        serviceCategory: result.serviceCategory,
        schemaVersion: result.schemaVersion,
        dataSource: result.dataSource,
        categories: result.categories,
        summary: result.summary,
        alerts: result.alerts,
        generatedAt: new Date(result.generatedAt),
      },
      { upsert: true, new: true }
    );

    console.log('[EnterpriseChecklist] Generated', {
      documentId: String(documentId),
      readiness: result.summary.readinessLabel,
      missing: result.summary.missing,
      criticalMissing: result.summary.criticalMissing,
      alerts: result.alerts.length,
    });

    return result;
  }

  async getChecklist(documentId: string, refresh = false): Promise<DynamicChecklistResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);
    // Always merge latest workflow into checklist items. Serving the Mongo cache alone
    // ignored checkbox state and made check/uncheck appear to revert on refetch.
    return this.generateAndStore(
      document._id,
      document.tenderId,
      refresh ? { refresh: true } : { refresh: true, workflowOnly: true }
    );
  }

  async updateItemWorkflow(
    documentId: string,
    userId: Types.ObjectId,
    userRole: UserRole,
    update: ChecklistItemWorkflowUpdate
  ): Promise<DynamicChecklistResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    await checklistWorkflowService.applyUpdate(
      document._id,
      document.tenderId,
      userId,
      userRole,
      update
    );

    return this.generateAndStore(document._id, document.tenderId, {
      refresh: true,
      workflowOnly: true,
    });
  }
}

export const dynamicChecklistService = new DynamicChecklistService();
