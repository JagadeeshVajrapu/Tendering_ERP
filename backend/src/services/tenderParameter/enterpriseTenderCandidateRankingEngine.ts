import { PageText } from '../../types/intelligence';
import { MasterDatasetKey } from '../../types/masterDataset';
import {
  EnterpriseCandidateRankingResult,
  EnterpriseRankBreakdown,
  EnterpriseRankedCandidate,
  EnterpriseRankingSelection,
} from '../../types/enterpriseTenderCandidateRanking';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { normalizeAliasKey } from './tenderParameterAliasEngine';
import { getDictionaryCanonicalLabel } from './masterTenderParameterDictionaryEngine';
import {
  isGarbageTenderParameterLabel,
  passesExtendedTenderParameterQuality,
} from './tenderParameterQualityEngine';
import {
  detectSpecialRuleViolation,
  getContextLabelsForKey,
  RANKING_CONTEXT_LABEL_RULES,
  RANKING_SECTION_RULES,
  RANKING_SPECIAL_RULES,
  scoreSectionPriority,
} from './rankingRuleRegistry';
import {
  compareCandidatesByPagePriority,
  resolvePagePriorityAnalysis,
  scorePagePriorityForCandidate,
  getEnterprisePagePriorityRuleSummary,
} from './enterprisePagePriorityEngine';
import { validateCandidateSectionAssignment } from '../tenderIntelligence/enterpriseSectionCandidateValidator';
import { PageSectionClassification } from '../tenderIntelligence/enterpriseSectionDetectionEngine';
import {
  getEnterpriseCandidateRankingDuplicateSummary,
  rankAndDeduplicateCandidates,
} from './enterpriseCandidateRankingDuplicateEngine';

/** Hard-reject only empty templates — annexure/spec pages hold real tender parameters. */
const STRICT_TEMPLATE_REJECT_RX =
  /\b(declaration\s+form|self[\s-]?declaration|undertaking\s+form|template|specimen\s+format|sample\s+format|form\s+of\s+bid|bid\s+form|integrity\s+pact|table\s+of\s+contents|index\s+of)\b/i;


const REJECT_HEADER_FOOTER_RX =
  /\b(page\s+(no\.?|number)|printed\s+on|generated\s+on|digitally\s+signed|confidential)\b/i;

const TABLE_RX =
  /\b(sl\.?\s*no|sr\.?\s*no|particulars|description|amount|details)\b.*\b(date|value|fee|emd|turnover)\b/i;

const TABLE_STRUCTURE_RX = /(\|\s*\w+)|(\t\w+)|(\s{3,}\w+\s{3,})/;

const OCR_GARBAGE_RX = /[|]{3,}|_{3,}|x{4,}|[^\x20-\x7E\u20B9]{5,}/i;

const FACTOR_WEIGHTS = {
  labelMatch: 0.22,
  contextMatch: 0.18,
  sectionPriority: 0.15,
  pagePriority: 0.25,
  tableDetection: 0.08,
  ocrQuality: 0.05,
  aiConfidence: 0.07,
};

function groupKey(row: TenderParameterCandidateRow): string {
  return row.canonicalKey || normalizeAliasKey(row.parameter);
}

function buildPageTextMap(pages: PageText[]): Map<number, string> {
  return new Map(pages.map((p) => [p.pageNumber, p.text || '']));
}

function getPageContext(page: number, pageMap: Map<number, string>, sourceText: string): string {
  const chunks = [sourceText];
  for (const offset of [-1, 0, 1]) {
    const text = pageMap.get(page + offset);
    if (text) chunks.push(text.slice(0, 3000));
  }
  return chunks.join('\n');
}

function isExactLabelMatch(row: TenderParameterCandidateRow): boolean {
  const original = normalizeAliasKey(row.originalLabel || row.parameter);
  const canonical = normalizeAliasKey(row.parameter);
  if (original === canonical) return true;
  if (row.canonicalKey) {
    const dictLabel = normalizeAliasKey(getDictionaryCanonicalLabel(row.canonicalKey as MasterDatasetKey));
    if (original === dictLabel) return true;
  }
  const source = normalizeAliasKey(row.sourceText || '');
  if (source.includes(canonical)) return true;
  return false;
}

function scoreLabelMatch(row: TenderParameterCandidateRow): number {
  if (isExactLabelMatch(row)) return 100;
  if (row.aliasMapped && (row.aliasMatchScore ?? 0) >= 95) return 95;
  if (row.aliasMapped && (row.aliasMatchScore ?? 0) >= 80) return 90;
  if (row.aliasMapped) return 85;

  const source = normalizeAliasKey(row.sourceText || '');
  const param = normalizeAliasKey(row.parameter);
  if (source.includes(param)) return 80;
  return 50;
}

function scoreContextMatch(row: TenderParameterCandidateRow, context: string): number {
  const labels = getContextLabelsForKey(row.canonicalKey);
  if (!labels.length) {
    const param = normalizeAliasKey(row.parameter);
    return context.includes(param) ? 70 : 45;
  }

  const lower = context.toLowerCase();
  let hits = 0;
  for (const label of labels) {
    if (lower.includes(label)) hits += 1;
  }
  if (hits >= 2) return 100;
  if (hits === 1) return 85;
  return 35;
}

function scorePagePriority(
  row: TenderParameterCandidateRow,
  pageMap: Map<number, string>
): number {
  const pageText = pageMap.get(row.page) || '';
  return scorePagePriorityForCandidate(row, pageText);
}

function scoreTableDetection(context: string, sourceText: string): number {
  const combined = `${context}\n${sourceText}`;
  if (TABLE_RX.test(combined)) return 100;
  if (TABLE_STRUCTURE_RX.test(sourceText)) return 85;
  if (/\bschedule\b/i.test(combined) && /\bdate\b/i.test(combined)) return 75;
  return 20;
}

function scoreOcrQuality(sourceText: string, value: string): number {
  const text = `${sourceText} ${value}`.trim();
  if (!text || text.length < 6) return 20;
  if (OCR_GARBAGE_RX.test(text)) return 25;
  if (/[a-zA-Z]{1,2}\s[a-zA-Z]{1,2}\s[a-zA-Z]{1,2}/.test(text) && text.length < 40) return 40;

  const alphaNum = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const ratio = alphaNum / text.length;
  if (ratio >= 0.5) return 95;
  if (ratio >= 0.35) return 75;
  return 50;
}

function computeWeightedTotal(factors: Omit<EnterpriseRankBreakdown, 'total' | 'rejected' | 'rejectReason' | 'selectionReason'>): number {
  const total =
    factors.labelMatch * FACTOR_WEIGHTS.labelMatch +
    factors.contextMatch * FACTOR_WEIGHTS.contextMatch +
    factors.sectionPriority * FACTOR_WEIGHTS.sectionPriority +
    factors.pagePriority * FACTOR_WEIGHTS.pagePriority +
    factors.tableDetection * FACTOR_WEIGHTS.tableDetection +
    factors.ocrQuality * FACTOR_WEIGHTS.ocrQuality +
    factors.aiConfidence * FACTOR_WEIGHTS.aiConfidence;

  return Math.min(100, Math.round(total));
}

function detectHardRejectReason(
  context: string,
  sourceText: string,
  row?: TenderParameterCandidateRow
): string | null {
  const combined = `${context}\n${sourceText}`.toLowerCase();
  const qualityRow: TenderParameterCandidateRow = row || {
    parameter: '',
    originalLabel: '',
    value: sourceText,
    page: 1,
    confidence: 0,
    sourceText,
  };
  if (STRICT_TEMPLATE_REJECT_RX.test(combined) && !passesExtendedTenderParameterQuality(qualityRow)) {
    return 'declaration_template';
  }
  if (REJECT_HEADER_FOOTER_RX.test(combined)) return 'header_footer';
  if (sourceText.trim().length < 6) return 'insufficient_source_text';
  return null;
}

function buildSelectionReason(
  breakdown: EnterpriseRankBreakdown,
  candidateCount: number,
  pagePriority?: number
): string {
  if (breakdown.rejected && breakdown.rejectReason) {
    return `Rejected: ${breakdown.rejectReason}`;
  }
  const parts = [
    `pagePriority=${pagePriority ?? breakdown.pagePriority}`,
    `label=${breakdown.labelMatch}`,
    `context=${breakdown.contextMatch}`,
    `section=${breakdown.sectionPriority}`,
    `table=${breakdown.tableDetection}`,
    `ocr=${breakdown.ocrQuality}`,
    `ai=${breakdown.aiConfidence}`,
  ];
  return candidateCount > 1
    ? `Selected highest page priority (${pagePriority ?? breakdown.pagePriority}) and score (${breakdown.total}) among ${candidateCount} candidates [${parts.join(', ')}]`
    : `Selected sole candidate (pagePriority ${pagePriority ?? breakdown.pagePriority}, score ${breakdown.total}) [${parts.join(', ')}]`;
}

export function scoreEnterpriseCandidate(
  row: TenderParameterCandidateRow,
  pageMap: Map<number, string>,
  pageClassifications: PageSectionClassification[] = []
): EnterpriseRankBreakdown {
  const context = getPageContext(row.page, pageMap, row.sourceText);
  const hardReject = detectHardRejectReason(context, row.sourceText, row);
  const specialReject = detectSpecialRuleViolation(row.canonicalKey, context, row.sourceText);

  if (hardReject || specialReject) {
    return {
      labelMatch: 0,
      contextMatch: 0,
      sectionPriority: 0,
      pagePriority: 0,
      tableDetection: 0,
      ocrQuality: 0,
      aiConfidence: 0,
      total: 0,
      rejected: true,
      rejectReason: specialReject || hardReject || 'rejected',
    };
  }

  const section = scoreSectionPriority(context);
  const pageText = pageMap.get(row.page) || '';
  const pageAnalysis = resolvePagePriorityAnalysis(row.page, pageText, row.sourceText);
  const annexurePenalty =
    pageAnalysis.isLowPrioritySection && !passesExtendedTenderParameterQuality(row) ? 15 : 0;
  const factors = {
    labelMatch: scoreLabelMatch(row),
    contextMatch: scoreContextMatch(row, context),
    sectionPriority: Math.max(10, section.score - annexurePenalty),
    pagePriority: scorePagePriority(row, pageMap),
    tableDetection: scoreTableDetection(context, row.sourceText),
    ocrQuality: scoreOcrQuality(row.sourceText, row.value),
    aiConfidence: Math.min(100, Math.max(0, row.confidence || 0)),
  };

  let total = computeWeightedTotal(factors);

  if (pageClassifications.length) {
    const sectionCheck = validateCandidateSectionAssignment(row, pageClassifications);
    if (!sectionCheck.allowed) {
      return {
        ...factors,
        sourceSection: pageAnalysis.sourceSection,
        priorityTier: pageAnalysis.priorityTier,
        total: 0,
        rejected: true,
        rejectReason: `wrong_section_${sectionCheck.matchType}`,
      };
    }
    if (sectionCheck.matchType === 'primary') total = Math.min(100, total + 8);
    else if (sectionCheck.matchType === 'fallback') total = Math.max(0, total - 5);
  }

  return {
    ...factors,
    sourceSection: pageAnalysis.sourceSection,
    priorityTier: pageAnalysis.priorityTier,
    total,
    rejected: false,
    selectionReason: pageAnalysis.sourceSection,
  };
}

export function rankEnterpriseTenderParameterCandidates(
  candidates: TenderParameterCandidateRow[],
  pages: PageText[] = [],
  pageClassifications: PageSectionClassification[] = [],
  opts?: { tenderType?: string }
): EnterpriseCandidateRankingResult {
  const filtered = candidates.filter(
    (row) => !isGarbageTenderParameterLabel(row.originalLabel || row.parameter)
  );

  return rankAndDeduplicateCandidates(filtered, pages, pageClassifications, {
    tenderType: opts?.tenderType,
  });
}

/** Backward-compatible wrapper */
export function rankTenderParameterCandidates(
  candidates: TenderParameterCandidateRow[],
  pages: PageText[] = []
) {
  const result = rankEnterpriseTenderParameterCandidates(candidates, pages);
  return {
    winners: result.winners,
    rejected: [...result.rejected, ...result.losers],
    stats: {
      inputCount: result.stats.inputCount,
      winnerCount: result.stats.winnerCount,
      rejectedByContext: result.stats.rejectedByContext + result.stats.rejectedBySpecialRule,
      duplicateGroups: result.stats.duplicateGroups,
    },
  };
}

export function getRankingRuleRegistrySummary() {
  return {
    ...getEnterpriseCandidateRankingDuplicateSummary(),
    legacyFactorWeights: FACTOR_WEIGHTS,
    pagePriority: getEnterprisePagePriorityRuleSummary(),
    sectionRules: RANKING_SECTION_RULES.map((r) => ({ id: r.id, label: r.label, score: r.score })),
    specialRules: RANKING_SPECIAL_RULES.map((r) => ({
      parameterKeys: r.parameterKeys,
      rejectReason: r.rejectReason,
      description: r.description,
    })),
    contextLabelRules: RANKING_CONTEXT_LABEL_RULES.map((r) => ({
      parameterKeys: r.parameterKeys,
      labels: r.labels,
    })),
  };
}
