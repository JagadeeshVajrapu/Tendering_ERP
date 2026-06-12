import {
  NitAnalysisFieldRow,
  NitAnalysisReport,
  NitAnalysisSectionReport,
  NitAnalysisStatistics,
  NitValidationDisplay,
} from '../../types/nitAnalysisReport';
import { EnterpriseMasterDatasetEntry, EnterpriseMasterDatasetResult } from '../../types/enterpriseMasterDataset';
import {
  ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
  DYNAMIC_NIT_DISPLAY_CATEGORIES,
  PROFESSIONAL_NIT_DISPLAY_CATEGORIES,
  PROFESSIONAL_NIT_SECTION_META,
  ProfessionalNitCategory,
} from './professionalNitAnalysisSections';
import { MASTER_DICTIONARY_PARAMETER_COUNT } from '../tenderParameter/masterTenderParameterDictionary';
import {
  isGarbageTenderParameterValue,
  isGenuineTenderParameterRow,
  isPageHeaderOrEnclosureLabel,
  rowResolvesAsCoreParameter,
} from '../tenderParameter/tenderParameterQualityEngine';
import { qualifiesForAdditionalTenderParameters } from '../tenderParameter/enterpriseDynamicParameterFilteringEngine';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import {
  isHiddenByDefaultConfidence,
  resolveConfidenceLabel,
  resolveConfidenceTier,
} from './nitConfidenceTier';

const STORED_STATUSES = new Set(['VALID', 'REVIEW', 'VALID_DYNAMIC_PARAMETER']);
const STORED_VERIFICATION_STATUSES = new Set(['VERIFIED', 'REVIEW']);

function mapValidationDisplay(status: string): NitValidationDisplay {
  if (status === 'VALID_DYNAMIC_PARAMETER') return 'Dynamic Parameter';
  if (status === 'REVIEW') return 'Review';
  return 'Validated';
}

function resolveSectionCategory(entry: EnterpriseMasterDatasetEntry): ProfessionalNitCategory {
  const cat = entry.category as ProfessionalNitCategory;
  if ((PROFESSIONAL_NIT_DISPLAY_CATEGORIES as readonly string[]).includes(cat)) return cat;
  if (entry.parameterType === 'dynamic' || entry.validationStatus === 'VALID_DYNAMIC_PARAMETER') {
    return ADDITIONAL_TENDER_PARAMETERS_CATEGORY;
  }
  return 'Identity';
}

function slugifyKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

function valueFingerprint(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

function buildFieldKey(entry: EnterpriseMasterDatasetEntry): string {
  const page = entry.pageNumber || 0;
  if (entry.canonicalKey) return String(entry.canonicalKey);
  const labelSlug = slugifyKey(entry.normalizedParameter || entry.parameter);
  const fp = valueFingerprint(entry.value || entry.sourceText || labelSlug);
  return `dyn_${labelSlug}_p${page}_${fp}`;
}

function ensureUniqueFieldKeys(rows: NitAnalysisFieldRow[]): NitAnalysisFieldRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const reactKeyBase = `${row.key}|${row.sourcePage}`;
    const count = seen.get(reactKeyBase) ?? 0;
    seen.set(reactKeyBase, count + 1);
    if (count === 0) return row;
    return { ...row, key: `${row.key}__${count}` };
  });
}

function toNitFieldRow(entry: EnterpriseMasterDatasetEntry): NitAnalysisFieldRow {
  const tier = resolveConfidenceTier(entry.verificationConfidence ?? entry.confidence);
  const category = resolveSectionCategory(entry);

  return {
    key: buildFieldKey(entry),
    label: entry.parameter,
    value: entry.value,
    confidence: entry.verificationConfidence ?? entry.confidence,
    confidenceTier: tier,
    confidenceLabel: resolveConfidenceLabel(tier),
    hiddenByDefault: isHiddenByDefaultConfidence(entry.verificationConfidence ?? entry.confidence),
    sourcePage: entry.pageNumber,
    category,
    parameterType: entry.parameterType,
    validationStatus: entry.validationStatus === 'REVIEW' ? 'review' : 'validated',
    validationDisplay: mapValidationDisplay(entry.validationStatus),
    normalizedParameter: entry.normalizedParameter,
    sourceSection: entry.sourceSection,
    rankingScore: entry.rankingScore,
  };
}

function buildCategoryCounts(rows: NitAnalysisFieldRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const cat of DYNAMIC_NIT_DISPLAY_CATEGORIES) {
    counts[cat] = 0;
  }
  for (const row of rows) {
    const cat = row.category || 'Identity';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

function buildConfidenceTierCounts(rows: NitAnalysisFieldRow[]): Record<string, number> {
  const counts: Record<string, number> = {
    Verified: 0,
    'High Confidence': 0,
    'Review Recommended': 0,
    'Low Confidence': 0,
  };
  for (const row of rows) {
    counts[row.confidenceLabel || 'Review Recommended'] =
      (counts[row.confidenceLabel || 'Review Recommended'] || 0) + 1;
  }
  return counts;
}

/**
 * Enterprise Dynamic NIT Analysis — reads ONLY from enterprise master dataset.
 * Nine professional sections including all validated dynamic parameters.
 */
export function buildEnterpriseDynamicNitAnalysis(
  tenderId: string,
  documentId: string,
  originalName: string | undefined,
  master: EnterpriseMasterDatasetResult,
  steps: string[] = ['enterprise_master_dataset']
): NitAnalysisReport {
  const stored = master.parameters.filter((p) => {
    if (!STORED_STATUSES.has(p.validationStatus) || !p.value?.trim()) return false;
    if (p.verificationStatus && !STORED_VERIFICATION_STATUSES.has(p.verificationStatus)) return false;
    const label = p.normalizedParameter || p.parameter;
    if (isPageHeaderOrEnclosureLabel(label)) return false;
    const isCore = rowResolvesAsCoreParameter({
      parameter: p.parameter,
      originalLabel: label,
      value: p.value,
      page: p.pageNumber,
      confidence: p.confidence,
      sourceText: p.sourceText,
      canonicalKey: p.canonicalKey,
      isCoreParameter: p.isCoreParameter,
    });
    if (isGarbageTenderParameterValue(p.value, { isCore })) return false;
    if (isCore) return isGenuineTenderParameterRow({
      parameter: p.parameter,
      originalLabel: label,
      value: p.value,
      page: p.pageNumber,
      confidence: p.confidence,
      sourceText: p.sourceText,
      canonicalKey: p.canonicalKey,
      isCoreParameter: p.isCoreParameter,
    });
    return isGenuineTenderParameterRow({
      parameter: p.parameter,
      originalLabel: label,
      value: p.value,
      page: p.pageNumber,
      confidence: p.confidence,
      sourceText: p.sourceText,
      canonicalKey: p.canonicalKey,
    });
  }).filter((p) => {
    if (p.isCoreParameter || p.parameterType === 'core') return true;
    if (p.category !== ADDITIONAL_TENDER_PARAMETERS_CATEGORY && p.parameterType !== 'dynamic') return true;
    return qualifiesForAdditionalTenderParameters({
      parameter: p.parameter,
      originalLabel: p.normalizedParameter || p.parameter,
      value: p.value,
      validationStatus: p.validationStatus,
      sourceText: p.sourceText,
      page: p.pageNumber,
    });
  });

  const rows = ensureUniqueFieldKeys(stored.map(toNitFieldRow)).sort((a, b) => {
    const catOrder =
      DYNAMIC_NIT_DISPLAY_CATEGORIES.indexOf(a.category as (typeof DYNAMIC_NIT_DISPLAY_CATEGORIES)[number]) -
      DYNAMIC_NIT_DISPLAY_CATEGORIES.indexOf(b.category as (typeof DYNAMIC_NIT_DISPLAY_CATEGORIES)[number]);
    if (catOrder !== 0) return catOrder;
    return a.label.localeCompare(b.label);
  });

  const byCategory = new Map<ProfessionalNitCategory, NitAnalysisFieldRow[]>();
  for (const cat of DYNAMIC_NIT_DISPLAY_CATEGORIES) {
    byCategory.set(cat, []);
  }

  for (const row of rows) {
    const cat = (row.category || 'Identity') as ProfessionalNitCategory;
    const list = byCategory.get(cat) || [];
    list.push(row);
    byCategory.set(cat, list);
  }

  const sections: NitAnalysisSectionReport[] = [];

  for (const cat of DYNAMIC_NIT_DISPLAY_CATEGORIES) {
    const fields = byCategory.get(cat) || [];
    if (!fields.length) continue;
    const meta = PROFESSIONAL_NIT_SECTION_META[cat];
    sections.push({
      id: meta.id,
      title: meta.title,
      intelligenceLabel: meta.intelligenceLabel,
      description: meta.description,
      fields,
    });
  }

  const categoryCounts = buildCategoryCounts(rows);
  const confidenceTierCounts = buildConfidenceTierCounts(rows);
  const visibleByDefault = rows.filter((r) => !r.hiddenByDefault).length;

  const statistics: NitAnalysisStatistics = {
    totalDiscovered: master.statistics.totalParameters,
    totalParametersExtracted: rows.length,
    mappedCount: master.statistics.validatedCount,
    populatedFields: rows.length,
    visibleByDefault,
    totalMasterFields: MASTER_DICTIONARY_PARAMETER_COUNT,
    coreCount: master.statistics.coreCount,
    dynamicCount: master.statistics.dynamicCount,
    reviewCount: master.statistics.reviewCount,
    pagesScanned: 0,
    averageConfidence: master.statistics.averageConfidence,
    categoryCounts,
    confidenceTierCounts,
    serviceCategory: master.serviceCategory,
    masterDatasetVersion: master.currentVersion,
  };

  return {
    tenderId,
    documentId,
    originalName,
    generatedAt: new Date().toISOString(),
    reportType: 'enterprise_dynamic',
    dataSource: 'enterprise_master_dataset',
    pipeline: { steps },
    tenderParameters: rows,
    sections,
    statistics,
  };
}

/** @deprecated Use buildEnterpriseDynamicNitAnalysis */
export const buildProfessionalNitAnalysisFromEnterprise = buildEnterpriseDynamicNitAnalysis;
