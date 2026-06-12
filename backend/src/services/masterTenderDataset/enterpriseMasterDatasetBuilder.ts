import {
  EnterpriseMasterDatasetDuplicateEntry,
  EnterpriseMasterDatasetEntry,
  EnterpriseMasterDatasetStatistics,
  EnterpriseValidationStatus,
} from '../../types/enterpriseMasterDataset';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { isAllowedMasterParameter, resolveDictionaryKey, normalizeParamName } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import { getDictionaryCanonicalLabel } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import {
  classifyProfessionalCategory,
  isGarbageTenderParameterValue,
  isGenuineTenderParameterRow,
  isPageHeaderOrEnclosureLabel,
  rowResolvesAsCoreParameter,
} from '../tenderParameter/tenderParameterQualityEngine';
import { getDictionaryGroup } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import {
  ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
  PROFESSIONAL_NIT_DISPLAY_CATEGORIES,
} from '../nit/professionalNitAnalysisSections';
import {
  compareByAdditiveRankScore,
  filterMasterDatasetRankingWinners,
} from '../tenderParameter/enterpriseCandidateRankingDuplicateEngine';
import { compareCandidatesByPagePriority } from '../tenderParameter/enterprisePagePriorityEngine';
import { normalizeAliasKey } from '../tenderParameter/tenderParameterAliasEngine';
import { qualifiesForAdditionalTenderParameters } from '../tenderParameter/enterpriseDynamicParameterFilteringEngine';

export const ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION = 5;

const ACCEPTED_VALIDATION_STATUSES = new Set<EnterpriseValidationStatus>([
  'VALID',
  'REVIEW',
  'VALID_DYNAMIC_PARAMETER',
]);

function isStorableCandidate(row: TenderParameterCandidateRow): boolean {
  if (!row.value?.trim()) return false;
  if (row.validationStatus === 'REJECT' || row.validationPassed === false) return false;

  const label = (row.originalLabel || row.parameter || '').trim();
  if (isPageHeaderOrEnclosureLabel(label)) return false;

  const isCore = rowResolvesAsCoreParameter(row);
  if (isGarbageTenderParameterValue(row.value, { isCore })) return false;

  if (isCore) return isGenuineTenderParameterRow(row);

  if (!isGenuineTenderParameterRow(row)) return false;

  if (
    !qualifiesForAdditionalTenderParameters({
      parameter: row.parameter,
      originalLabel: row.originalLabel,
      value: row.value,
      validationStatus: mapEnterpriseValidationStatus(row),
      sourceText: row.sourceText,
      page: row.page,
    })
  ) {
    return false;
  }

  const status = mapEnterpriseValidationStatus(row);
  return ACCEPTED_VALIDATION_STATUSES.has(status);
}

function resolveMasterDatasetCategory(
  row: TenderParameterCandidateRow,
  isCore: boolean,
  dictKey: ReturnType<typeof resolveDictionaryKey>
): string {
  const rawCategory = String(row.category || '').trim();
  if ((PROFESSIONAL_NIT_DISPLAY_CATEGORIES as readonly string[]).includes(rawCategory)) {
    return rawCategory;
  }

  if (isCore && dictKey) {
    return classifyProfessionalCategory(
      getDictionaryCanonicalLabel(dictKey),
      row.value,
      getDictionaryGroup(dictKey)
    );
  }

  return ADDITIONAL_TENDER_PARAMETERS_CATEGORY;
}

function mapEnterpriseValidationStatus(row: TenderParameterCandidateRow): EnterpriseValidationStatus {
  const s = row.validationStatus;
  if (s === 'REVIEW') return 'REVIEW';
  if (s === 'REJECT') return 'REJECT';
  if (s === 'VALID_DYNAMIC_PARAMETER') return 'VALID_DYNAMIC_PARAMETER';
  if (row.isCoreParameter === false && !isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
    return 'VALID_DYNAMIC_PARAMETER';
  }
  return 'VALID';
}

function groupKey(row: TenderParameterCandidateRow): string {
  const dict = resolveDictionaryKey(row.parameter, row.canonicalKey);
  if (dict) return `core:${dict}`;
  const valueKey = normalizeAliasKey(row.value).slice(0, 120);
  const paramKey = normalizeAliasKey(row.normalizedParameter || row.parameter);
  return `dyn:${paramKey}|${valueKey}`;
}

function inferSourceSection(row: TenderParameterCandidateRow): string {
  if (row.sourceSection?.trim()) return row.sourceSection.trim();
  const breakdown = row.rankBreakdown as { selectionReason?: string; sourceSection?: string } | null | undefined;
  if (breakdown?.sourceSection) return breakdown.sourceSection;
  if (breakdown?.selectionReason) return breakdown.selectionReason;
  if (row.category) return String(row.category);
  return 'general';
}

function toEntry(
  row: TenderParameterCandidateRow,
  opts: {
    documentId: string;
    tenderId: string;
    serviceCategory: string;
    duplicateHistory?: EnterpriseMasterDatasetDuplicateEntry[];
  }
): EnterpriseMasterDatasetEntry {
  const isCore =
    rowResolvesAsCoreParameter(row) || isAllowedMasterParameter(row.parameter, row.canonicalKey);
  const dictKey = resolveDictionaryKey(row.parameter, row.canonicalKey);
  const parameter = isCore && dictKey ? getDictionaryCanonicalLabel(dictKey) : row.parameter;
  const category = resolveMasterDatasetCategory(row, isCore, dictKey);

  const validationStatus = mapEnterpriseValidationStatus(row);

  return {
    documentId: opts.documentId,
    tenderId: opts.tenderId,
    parameter,
    normalizedParameter: row.normalizedParameter || parameter,
    value: row.value,
    category: String(category),
    serviceCategory: opts.serviceCategory,
    pageNumber: row.page,
    pagePriority: row.pagePriority ?? 0,
    confidence: Math.max(row.validationConfidence ?? 0, row.confidence ?? 0, 70),
    validationStatus,
    isCoreParameter: isCore,
    sourceText: row.sourceText || '',
    sourceSection: inferSourceSection(row),
    rankingScore: row.rankScore ?? 0,
    validationReason: row.validationReason || '',
    rankingReason: row.rankReason || '',
    canonicalKey: dictKey || row.canonicalKey,
    parameterType: isCore ? 'core' : 'dynamic',
    duplicateHistory: opts.duplicateHistory ?? [],
    schemaVersion: ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
  };
}

function scoreWinner(a: TenderParameterCandidateRow, b: TenderParameterCandidateRow): number {
  if (a.rankScore != null || b.rankScore != null) {
    return compareByAdditiveRankScore(a, b);
  }
  return compareCandidatesByPagePriority(a, b);
}

export function buildEnterpriseMasterDatasetEntries(
  candidates: TenderParameterCandidateRow[],
  opts: { documentId: string; tenderId: string; serviceCategory: string }
): { stored: EnterpriseMasterDatasetEntry[]; rejected: EnterpriseMasterDatasetEntry[] } {
  const rankedCandidates = filterMasterDatasetRankingWinners(candidates);
  const storable = rankedCandidates.filter(isStorableCandidate);
  const rejectedRows = rankedCandidates.filter((r) => !isStorableCandidate(r));

  const groups = new Map<string, TenderParameterCandidateRow[]>();
  for (const row of storable) {
    const key = groupKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const stored: EnterpriseMasterDatasetEntry[] = [];

  for (const [, group] of groups) {
    group.sort(scoreWinner);
    const winner = group[0];
    const duplicateHistory: EnterpriseMasterDatasetDuplicateEntry[] = group.slice(1).map((loser) => ({
      value: loser.value,
      pageNumber: loser.page,
      pagePriority: loser.pagePriority ?? 0,
      confidence: loser.validationConfidence ?? loser.confidence ?? 0,
      rankingScore: loser.rankScore ?? 0,
      sourceText: loser.sourceText || '',
      validationStatus: mapEnterpriseValidationStatus(loser),
    }));

    stored.push(
      toEntry(winner, {
        ...opts,
        duplicateHistory,
      })
    );
  }

  const rejected = rejectedRows.map((row) =>
    toEntry(row, { ...opts, duplicateHistory: [] })
  );

  return {
    stored: stored.sort((a, b) => a.pageNumber - b.pageNumber || a.parameter.localeCompare(b.parameter)),
    rejected,
  };
}

export function computeEnterpriseStatistics(
  stored: EnterpriseMasterDatasetEntry[],
  rejectedCount: number
): EnterpriseMasterDatasetStatistics {
  const categoryCounts: Record<string, number> = {};
  let confidenceSum = 0;
  let coreCount = 0;
  let dynamicCount = 0;
  let reviewCount = 0;
  let verifiedCount = 0;

  for (const p of stored) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    confidenceSum += p.confidence;
    if (p.isCoreParameter) coreCount += 1;
    else dynamicCount += 1;
    if (p.validationStatus === 'REVIEW') reviewCount += 1;
    if (p.verificationStatus === 'VERIFIED' || !p.verificationStatus) verifiedCount += 1;
  }

  return {
    totalParameters: stored.length,
    coreCount,
    dynamicCount,
    reviewCount,
    verifiedCount,
    verificationRejectedCount: 0,
    validatedCount: stored.filter((p) => p.validationStatus !== 'REVIEW').length,
    rejectedCount,
    averageConfidence: stored.length ? Math.round(confidenceSum / stored.length) : 0,
    categoryCounts,
  };
}

export function toValidatedMasterDatasetParameters(stored: EnterpriseMasterDatasetEntry[]) {
  return stored.map((p) => ({
    parameter: p.parameter,
    value: p.value,
    page: p.pageNumber,
    confidence: p.confidence,
    sourceText: p.sourceText,
    validationStatus:
      p.validationStatus === 'REVIEW'
        ? ('review' as const)
        : ('validated' as const),
    category: p.category,
    parameterType: p.parameterType,
    canonicalKey: p.canonicalKey,
    originalLabel: p.normalizedParameter !== p.parameter ? p.normalizedParameter : p.parameter,
  }));
}

export function diffVersions(
  previous: EnterpriseMasterDatasetEntry[],
  current: EnterpriseMasterDatasetEntry[]
): { added: number; removed: number; valueChanged: number } {
  const prevMap = new Map(previous.map((p) => [normalizeAliasKey(p.normalizedParameter), p.value]));
  const currMap = new Map(current.map((p) => [normalizeAliasKey(p.normalizedParameter), p.value]));

  let added = 0;
  let removed = 0;
  let valueChanged = 0;

  for (const [key, value] of currMap) {
    if (!prevMap.has(key)) added += 1;
    else if (prevMap.get(key) !== value) valueChanged += 1;
  }
  for (const key of prevMap.keys()) {
    if (!currMap.has(key)) removed += 1;
  }

  return { added, removed, valueChanged };
}
