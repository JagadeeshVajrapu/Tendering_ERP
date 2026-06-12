import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { FeasibilityReport } from '../../models/FeasibilityReport';
import { workflowService } from '../workflow/workflowService';
import { auditService } from '../audit/auditService';
import {
  EnterpriseFeasibilityReport,
  FeasibilityDecisionEntry,
  MdFeasibilityAction,
} from '../../types/enterpriseFeasibilityReport';
import { UserRole, FinanceRequestType, TenderStatus } from '../../types';
import { parseAmount } from '../../utils/parseAmount';
import { Tender } from '../../models/Tender';

class EnterpriseFeasibilityWorkflowService {
  private async loadReport(tenderId: string) {
    const report = await FeasibilityReport.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!report) throw new AppError('Generate feasibility report first', 400);
    const enterprise = (report as { enterpriseReport?: EnterpriseFeasibilityReport }).enterpriseReport;
    if (!enterprise) throw new AppError('Enterprise feasibility report data missing. Regenerate report.', 400);
    return { report, enterprise };
  }

  private async appendDecision(
    reportId: Types.ObjectId,
    enterprise: EnterpriseFeasibilityReport,
    entry: FeasibilityDecisionEntry,
    approvalStatus: EnterpriseFeasibilityReport['approvalStatus']
  ) {
    const history = [...(enterprise.decisionHistory || []), entry];
    await FeasibilityReport.findByIdAndUpdate(reportId, {
      approvalStatus,
      decisionHistory: history,
      enterpriseReport: { ...enterprise, approvalStatus, decisionHistory: history },
    });
  }

  async submitToMd(tenderId: string, userId: Types.ObjectId, userRole: UserRole) {
    const { report, enterprise } = await this.loadReport(tenderId);

    await workflowService.submitToMd(tenderId, userId, userRole, String(report._id));

    const entry: FeasibilityDecisionEntry = {
      action: 'submit_to_md',
      by: String(userId),
      byRole: userRole,
      at: new Date().toISOString(),
      comments: 'Submitted for MD review',
    };

    await this.appendDecision(report._id, enterprise, entry, 'submitted');
    await FeasibilityReport.findByIdAndUpdate(report._id, { submittedAt: new Date() });

    return { tenderId, approvalStatus: 'submitted' };
  }

  async mdAction(
    tenderId: string,
    action: MdFeasibilityAction,
    userId: Types.ObjectId,
    userRole: UserRole,
    comments?: string
  ) {
    const { report, enterprise } = await this.loadReport(tenderId);
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const entry: FeasibilityDecisionEntry = {
      action,
      by: String(userId),
      byRole: userRole,
      at: new Date().toISOString(),
      comments,
    };

    switch (action) {
      case 'approve':
        await workflowService.mdDecision(tenderId, true, userId, userRole, comments);
        await this.appendDecision(report._id, enterprise, entry, 'approved');
        await this.triggerPostApprovalFinance(tenderId, userId, enterprise);
        break;

      case 'reject':
        await workflowService.mdDecision(tenderId, false, userId, userRole, comments);
        await this.appendDecision(report._id, enterprise, entry, 'rejected');
        break;

      case 'participate_with_conditions':
        await workflowService.mdDecision(tenderId, true, userId, userRole, comments || 'Participate with conditions');
        await this.appendDecision(report._id, enterprise, entry, 'conditional');
        tender.status = TenderStatus.APPROVED_BY_MD;
        tender.currentStage = 'Approved with Conditions';
        await tender.save();
        break;

      case 'request_clarification':
        await this.appendDecision(report._id, enterprise, entry, 'review');
        await workflowService.updateTenderStatus(
          tenderId,
          TenderStatus.PENDING_MD_APPROVAL,
          userId,
          userRole,
          { mdReview: 'clarification_requested' }
        );
        break;

      case 'request_missing_documents': {
        const missing = enterprise.checklistReadiness.criticalMissing.length
          ? enterprise.checklistReadiness.criticalMissing
          : enterprise.complianceWorkflow?.missingDocuments || [];
        await workflowService.createComplianceRequest(tenderId, userId, missing);
        await this.appendDecision(report._id, enterprise, entry, 'review');
        break;
      }

      case 'request_finance_approval':
        await this.triggerPostApprovalFinance(tenderId, userId, enterprise, true);
        await this.appendDecision(report._id, enterprise, entry, 'approved');
        break;

      case 'request_compliance_review':
        await workflowService.createComplianceRequest(
          tenderId,
          userId,
          enterprise.complianceWorkflow?.missingDocuments || []
        );
        await this.appendDecision(report._id, enterprise, entry, 'review');
        break;

      default:
        throw new AppError('Invalid MD action', 400);
    }

    await auditService.log({
      userId,
      userRole,
      action: `FEASIBILITY_MD_${action.toUpperCase()}`,
      entityType: 'FeasibilityReport',
      entityId: String(report._id),
      newValue: { action, comments },
    });

    const updated = await FeasibilityReport.findById(report._id).lean();
    return updated;
  }

  private async triggerPostApprovalFinance(
    tenderId: string,
    userId: Types.ObjectId,
    enterprise: EnterpriseFeasibilityReport,
    force = false
  ) {
    const emd = parseAmount(enterprise.financialSummary.emd);
    const fee = parseAmount(enterprise.financialSummary.tenderFee);
    const bg = parseAmount(enterprise.financialSummary.bankGuarantee || enterprise.financialSummary.performanceSecurity);

    if (emd > 0) {
      await workflowService.createFinanceRequest(tenderId, userId, FinanceRequestType.EMD, emd);
      if (enterprise.financeWorkflow) enterprise.financeWorkflow.emdStatus = 'Requested';
    }
    if (fee > 0 && force) {
      await workflowService.createFinanceRequest(tenderId, userId, FinanceRequestType.DD, fee);
      if (enterprise.financeWorkflow) enterprise.financeWorkflow.tenderFeeStatus = 'Requested';
    }
    if (bg > 0) {
      await workflowService.createFinanceRequest(tenderId, userId, FinanceRequestType.BG, bg);
      if (enterprise.financeWorkflow) enterprise.financeWorkflow.bgStatus = 'Requested';
    }
  }
}

export const enterpriseFeasibilityWorkflowService = new EnterpriseFeasibilityWorkflowService();
