import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { getPrimarySectionForParameter } from '../tenderIntelligence/enterpriseSectionParameterRegistry';
import { StrictValidationStatus } from './strictValueValidationEngine';

export interface ValidationConfidenceFactors {
  pagePriority: number;
  sectionMatch: number;
  aliasMatch: number;
  formatValidation: number;
  tenderTypeMatch: number;
  total: number;
}

export function computeEnterpriseValidationConfidence(
  row: TenderParameterCandidateRow,
  opts?: {
    formatStatus?: StrictValidationStatus | 'PASS' | 'NONE';
    sectionMatchType?: 'primary' | 'fallback' | 'none';
    tenderTypeMatch?: boolean;
  }
): { confidence: number; factors: ValidationConfidenceFactors } {
  const factors: ValidationConfidenceFactors = {
    pagePriority: 0,
    sectionMatch: 0,
    aliasMatch: 0,
    formatValidation: 0,
    tenderTypeMatch: 0,
    total: 0,
  };

  const pagePriority = row.pagePriority ?? 0;
  if (pagePriority >= 70) factors.pagePriority = 30;
  else if (pagePriority >= 40) factors.pagePriority = 15;

  const primarySection = getPrimarySectionForParameter(row.parameter, row.canonicalKey);
  if (opts?.sectionMatchType === 'primary') {
    factors.sectionMatch = 25;
  } else if (opts?.sectionMatchType === 'fallback') {
    factors.sectionMatch = 12;
  } else if (primarySection && row.sectionName === primarySection) {
    factors.sectionMatch = 25;
  } else if (row.sectionName && primarySection) {
    factors.sectionMatch = 8;
  }

  if (row.aliasMapped && (row.aliasMatchScore ?? 0) >= 80) {
    factors.aliasMatch = 15;
  } else if (row.aliasMapped) {
    factors.aliasMatch = 8;
  }

  const fmt = opts?.formatStatus ?? 'NONE';
  if (fmt === 'VALID' || fmt === 'PASS') factors.formatValidation = 20;
  else if (fmt === 'REVIEW') factors.formatValidation = 8;

  if (opts?.tenderTypeMatch) factors.tenderTypeMatch = 20;

  factors.total = Math.min(
    100,
    factors.pagePriority +
      factors.sectionMatch +
      factors.aliasMatch +
      factors.formatValidation +
      factors.tenderTypeMatch
  );

  return { confidence: factors.total, factors };
}

export function resolveSectionMatchType(
  row: TenderParameterCandidateRow
): 'primary' | 'fallback' | 'none' {
  const primary = getPrimarySectionForParameter(row.parameter, row.canonicalKey);
  if (!primary || !row.sectionName) return 'none';
  if (row.sectionName === primary) return 'primary';
  return 'fallback';
}

export function getValidationConfidenceRuleSummary() {
  return {
    maxScore: 100,
    factors: [
      { name: 'Page Priority Match', points: 30, threshold: 'pagePriority >= 70' },
      { name: 'Section Match', points: 25, threshold: 'parameter primary section matches page section' },
      { name: 'Alias Match', points: 15, threshold: 'aliasMatchScore >= 80' },
      { name: 'Format Validation', points: 20, threshold: 'strict value validation VALID' },
      { name: 'Tender-Type Match', points: 20, threshold: 'parameter matches detected tender-type library' },
    ],
  };
}
