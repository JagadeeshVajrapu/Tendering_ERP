import type { TenderStatus } from '@/types';

/** Human-readable labels aligned with workflow stage names */
export const TENDER_STATUS_LABELS: Record<TenderStatus | string, string> = {
  DRAFT: 'Draft',
  NIT_ANALYZED: 'Analysis Completed',
  SUMMARY_GENERATED: 'Report Generated',
  PENDING_MD_APPROVAL: 'Pending MD Approval',
  APPROVED_BY_MD: 'Approved by MD',
  REJECTED_BY_MD: 'Rejected by MD',
  FINANCE_PENDING: 'Finance Pending',
  FINANCE_APPROVED: 'Finance Approved',
  FINANCE_REJECTED: 'Finance Rejected',
  MANAGER_PENDING: 'Compliance Pending',
  MANAGER_APPROVED: 'Compliance Approved',
  READY_FOR_BID: 'Ready for Bid',
  SUBMITTED: 'Submitted',
  AWARDED: 'Awarded',
};

/** Statuses where the enum is always the source of truth (never overridden by stale currentStage). */
const AUTHORITATIVE_STATUS = new Set([
  'SUBMITTED',
  'AWARDED',
  'READY_FOR_BID',
  'REJECTED_BY_MD',
  'FINANCE_REJECTED',
]);

const STAGE_ALIASES: Record<string, string> = {
  'NIT Analyzed': 'Analysis Completed',
  'Analysis Complete': 'Analysis Completed',
  'Analysis Completed': 'Analysis Completed',
  'MD Report Generated': 'Report Generated',
  'Report Generated': 'Report Generated',
  Submitted: 'Submitted',
  Awarded: 'Awarded',
};

export function normalizeStageLabel(stage?: string): string {
  if (!stage?.trim()) return '';
  return STAGE_ALIASES[stage] || stage;
}

export interface TenderDisplayOptions {
  /** From submission tracking module — overrides when tender record is stale */
  submissionStatus?: 'draft' | 'ready' | 'locked' | 'submitted';
}

/**
 * Resolve the effective tender status enum for badges/colors.
 * Merges tender.status with live submission tracking when needed.
 */
export function resolveEffectiveTenderStatus(
  status?: string,
  options?: TenderDisplayOptions
): string | undefined {
  if (options?.submissionStatus === 'submitted' && status !== 'AWARDED') {
    return 'SUBMITTED';
  }
  if (options?.submissionStatus === 'locked' && !AUTHORITATIVE_STATUS.has(status || '')) {
    return status || 'READY_FOR_BID';
  }
  return status;
}

/**
 * Display label — authoritative statuses win; submission tracking can elevate to Submitted.
 */
export function getTenderDisplayLabel(
  status?: string,
  currentStage?: string,
  options?: TenderDisplayOptions
): string {
  const effectiveStatus = resolveEffectiveTenderStatus(status, options);

  if (effectiveStatus && AUTHORITATIVE_STATUS.has(effectiveStatus)) {
    return TENDER_STATUS_LABELS[effectiveStatus] || effectiveStatus;
  }

  if (options?.submissionStatus === 'submitted' && effectiveStatus !== 'AWARDED') {
    return TENDER_STATUS_LABELS.SUBMITTED;
  }

  const normalizedStage = normalizeStageLabel(currentStage);

  if (effectiveStatus && TENDER_STATUS_LABELS[effectiveStatus]) {
    const enumLabel = TENDER_STATUS_LABELS[effectiveStatus];
    if (
      normalizedStage &&
      normalizedStage !== 'Draft' &&
      normalizedStage !== enumLabel &&
      !AUTHORITATIVE_STATUS.has(effectiveStatus)
    ) {
      return normalizedStage;
    }
    return enumLabel;
  }

  if (normalizedStage && normalizedStage !== 'Draft') {
    return normalizedStage;
  }

  if (effectiveStatus) {
    return effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return 'Draft';
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
    NIT_ANALYZED: 'bg-blue-100 text-blue-800 border-blue-200',
    SUMMARY_GENERATED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    PENDING_MD_APPROVAL: 'bg-amber-100 text-amber-900 border-amber-200',
    APPROVED_BY_MD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REJECTED_BY_MD: 'bg-red-100 text-red-800 border-red-200',
    FINANCE_PENDING: 'bg-orange-100 text-orange-900 border-orange-200',
    FINANCE_APPROVED: 'bg-green-100 text-green-800 border-green-200',
    FINANCE_REJECTED: 'bg-red-100 text-red-800 border-red-200',
    MANAGER_PENDING: 'bg-purple-100 text-purple-900 border-purple-200',
    MANAGER_APPROVED: 'bg-teal-100 text-teal-800 border-teal-200',
    READY_FOR_BID: 'bg-cyan-100 text-cyan-900 border-cyan-200',
    SUBMITTED: 'bg-violet-100 text-violet-900 border-violet-200',
    AWARDED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}
