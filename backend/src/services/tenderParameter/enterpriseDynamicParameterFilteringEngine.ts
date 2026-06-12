import {
  DynamicParameterFilterResult,
  DynamicParameterFilterScores,
  EnterpriseDynamicParameterFilteringSummary,
} from '../../types/enterpriseDynamicParameterFiltering';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { matchesTenderTypeLibraryParameter } from '../tenderIntelligence/enterpriseTenderTypeLibraryEngine';
import { GENUINE_REQUIREMENT_QUESTION } from './dynamicParameterAiEvaluator';
import {
  BUSINESS_RELEVANT_CATEGORIES,
  getBusinessRelevantDiscoveryRuleSummary,
  isKnownAdditionalTenderParameter,
  looksLikeAdditionalTenderRequirement,
  normalizeBusinessCategory,
  rejectBusinessIrrelevantDynamicParameter,
} from './businessRelevantDynamicParameterEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import { rowResolvesAsCoreParameter } from './tenderParameterQualityEngine';

export const DYNAMIC_PARAMETER_FILTER_THRESHOLD = 70;

export const DYNAMIC_FILTER_WEIGHTS = {
  businessRelevance: 50,
  tenderTypeMatch: 20,
  validationPassed: 20,
  aiRelevanceApproved: 10,
} as const;

export interface DynamicParameterFilterInput {
  parameter: string;
  originalLabel?: string;
  value: string;
  sourceText?: string;
  page?: number;
  validationStatus?: string;
  validationPassed?: boolean;
  canonicalKey?: string;
  tenderType?: string;
  aiGenuine?: boolean;
  aiCategory?: string;
  skipAiRequirement?: boolean;
}

function scoreBusinessRelevance(row: DynamicParameterFilterInput): number {
  const label = (row.originalLabel || row.parameter || '').trim();
  const value = String(row.value || '').trim();
  if (!label || !value) return 0;

  const noiseReason = rejectBusinessIrrelevantDynamicParameter({
    parameter: label,
    value,
    sourceText: row.sourceText,
    page: row.page,
  });
  if (noiseReason) return 0;

  if (isKnownAdditionalTenderParameter(label) || isKnownAdditionalTenderParameter(row.parameter)) {
    return DYNAMIC_FILTER_WEIGHTS.businessRelevance;
  }

  if (looksLikeAdditionalTenderRequirement(label, value)) {
    return DYNAMIC_FILTER_WEIGHTS.businessRelevance;
  }

  if (row.aiGenuine === true) {
    return DYNAMIC_FILTER_WEIGHTS.businessRelevance;
  }

  if (row.skipAiRequirement && row.aiGenuine !== false) {
    return DYNAMIC_FILTER_WEIGHTS.businessRelevance;
  }

  return 0;
}

function scoreValidation(row: DynamicParameterFilterInput): number {
  const status = row.validationStatus;
  if (status === 'REJECT' || row.validationPassed === false) return 0;
  if (
    status === 'VALID' ||
    status === 'VALID_DYNAMIC_PARAMETER' ||
    row.validationPassed === true
  ) {
    return DYNAMIC_FILTER_WEIGHTS.validationPassed;
  }
  if (status === 'REVIEW') return Math.round(DYNAMIC_FILTER_WEIGHTS.validationPassed / 2);
  return 0;
}

function scoreTenderType(row: DynamicParameterFilterInput): number {
  if (!row.tenderType) return 0;
  const label = row.originalLabel || row.parameter;
  if (matchesTenderTypeLibraryParameter(label, row.tenderType)) {
    return DYNAMIC_FILTER_WEIGHTS.tenderTypeMatch;
  }
  if (matchesTenderTypeLibraryParameter(row.parameter, row.tenderType)) {
    return DYNAMIC_FILTER_WEIGHTS.tenderTypeMatch;
  }
  return 0;
}

function scoreAiRelevance(row: DynamicParameterFilterInput): number {
  if (row.aiGenuine === true) return DYNAMIC_FILTER_WEIGHTS.aiRelevanceApproved;
  return 0;
}

export function computeDynamicParameterFilterScores(
  row: DynamicParameterFilterInput
): DynamicParameterFilterScores {
  const businessRelevance = scoreBusinessRelevance(row);
  const tenderTypeMatch = scoreTenderType(row);
  const validationPassed = scoreValidation(row);
  const aiRelevanceApproved = scoreAiRelevance(row);

  return {
    businessRelevance,
    tenderTypeMatch,
    validationPassed,
    aiRelevanceApproved,
    total: businessRelevance + tenderTypeMatch + validationPassed + aiRelevanceApproved,
  };
}

export function filterEnterpriseDynamicParameter(
  row: DynamicParameterFilterInput
): DynamicParameterFilterResult {
  const label = (row.originalLabel || row.parameter || '').trim();
  const noiseReason = rejectBusinessIrrelevantDynamicParameter({
    parameter: label,
    value: row.value,
    sourceText: row.sourceText,
    page: row.page,
  });

  if (noiseReason) {
    return {
      parameter: row.parameter,
      value: row.value,
      category: 'Noise',
      status: 'REJECT',
      stored: false,
      filterScore: 0,
      scores: {
        businessRelevance: 0,
        tenderTypeMatch: 0,
        validationPassed: 0,
        aiRelevanceApproved: 0,
        total: 0,
      },
      rejectionReason: noiseReason,
      aiEvaluated: row.aiGenuine !== undefined,
    };
  }

  const scores = computeDynamicParameterFilterScores(row);
  const category = normalizeBusinessCategory(row.aiCategory || 'Tender Specific');
  const stored = scores.total >= DYNAMIC_PARAMETER_FILTER_THRESHOLD;

  let status: DynamicParameterFilterResult['status'] = 'REJECT';
  if (stored) {
    status =
      row.validationStatus === 'REVIEW'
        ? 'REVIEW'
        : 'VALID_DYNAMIC';
  }

  return {
    parameter: row.parameter,
    value: row.value,
    category,
    status,
    stored,
    filterScore: scores.total,
    scores,
    rejectionReason: stored
      ? undefined
      : `Filter score ${scores.total} below threshold ${DYNAMIC_PARAMETER_FILTER_THRESHOLD}`,
    aiEvaluated: row.aiGenuine !== undefined,
  };
}

export function filterEnterpriseDynamicParameterRow(
  row: TenderParameterCandidateRow,
  opts?: { tenderType?: string; aiGenuine?: boolean; aiCategory?: string }
): DynamicParameterFilterResult {
  if (rowResolvesAsCoreParameter(row) || isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
    return {
      parameter: row.parameter,
      value: row.value,
      category: row.category || 'Identity',
      status: 'VALID_DYNAMIC',
      stored: true,
      filterScore: 100,
      scores: {
        businessRelevance: 50,
        tenderTypeMatch: 20,
        validationPassed: 20,
        aiRelevanceApproved: 10,
        total: 100,
      },
    };
  }

  return filterEnterpriseDynamicParameter({
    parameter: row.parameter,
    originalLabel: row.originalLabel,
    value: row.value,
    sourceText: row.sourceText,
    page: row.page,
    validationStatus: row.validationStatus,
    validationPassed: row.validationPassed ?? undefined,
    canonicalKey: row.canonicalKey,
    tenderType: opts?.tenderType,
    aiGenuine: opts?.aiGenuine,
    aiCategory: opts?.aiCategory,
  });
}

export function shouldStoreDynamicParameter(
  row: TenderParameterCandidateRow,
  opts?: { tenderType?: string; aiGenuine?: boolean; aiCategory?: string }
): boolean {
  if (rowResolvesAsCoreParameter(row)) return true;
  const status = row.validationStatus;
  if (status === 'VALID') return true;
  if (status === 'REJECT' || row.validationPassed === false) return false;

  return filterEnterpriseDynamicParameterRow(row, opts).stored;
}

export function qualifiesForAdditionalTenderParameters(row: {
  parameter: string;
  originalLabel?: string;
  value: string;
  validationStatus?: string;
  validationPassed?: boolean;
  sourceText?: string;
  page?: number;
  tenderType?: string;
  aiGenuine?: boolean;
  aiCategory?: string;
}): boolean {
  return filterEnterpriseDynamicParameter({
    parameter: row.parameter,
    originalLabel: row.originalLabel,
    value: row.value,
    sourceText: row.sourceText,
    page: row.page,
    validationStatus: row.validationStatus,
    validationPassed: row.validationPassed,
    tenderType: row.tenderType,
    aiGenuine: row.aiGenuine,
    aiCategory: row.aiCategory,
    skipAiRequirement: isKnownAdditionalTenderParameter(row.originalLabel || row.parameter),
  }).stored;
}

export function getEnterpriseDynamicParameterFilteringSummary(): EnterpriseDynamicParameterFilteringSummary {
  const rules = getBusinessRelevantDiscoveryRuleSummary();
  return {
    engine: 'enterprise_dynamic_parameter_filtering',
    scoreThreshold: DYNAMIC_PARAMETER_FILTER_THRESHOLD,
    weights: { ...DYNAMIC_FILTER_WEIGHTS },
    allowedCategories: BUSINESS_RELEVANT_CATEGORIES,
    rejectedNoiseTypes: rules.rejectedNoiseTypes,
    aiQuestion: GENUINE_REQUIREMENT_QUESTION,
    outputExample: {
      parameter: 'Warranty Period',
      value: '24 Months',
      category: 'Tender Specific',
      status: 'VALID_DYNAMIC',
      stored: true,
      filterScore: 80,
      scores: {
        businessRelevance: 50,
        tenderTypeMatch: 0,
        validationPassed: 20,
        aiRelevanceApproved: 10,
        total: 80,
      },
    },
  };
}
