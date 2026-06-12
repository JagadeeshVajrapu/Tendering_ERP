import { PageText } from '../../types/intelligence';
import {
  EnterpriseAdditiveRankScores,
  EnterpriseCandidateRankingResult,
  EnterpriseRankedParameterOutput,
  EnterpriseRankedCandidate,
  EnterpriseRankingSelection,
} from '../../types/enterpriseTenderCandidateRanking';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { PageSectionClassification } from '../tenderIntelligence/enterpriseSectionDetectionEngine';
import { validateCandidateSectionAssignment } from '../tenderIntelligence/enterpriseSectionCandidateValidator';
import { matchesTenderTypeLibraryParameter } from '../tenderIntelligence/enterpriseTenderTypeLibraryEngine';
import { resolvePagePriorityAnalysis } from './enterprisePagePriorityEngine';
import { normalizeAliasKey } from './enterpriseTenderAliasEngine';
import {
  isGarbageTenderParameterValue,
  isGenuineTenderParameterRow,
  rowResolvesAsCoreParameter,
} from './tenderParameterQualityEngine';
import { validateStrictParameterValue, resolveStrictParameterKind } from './strictValueValidationEngine';

export const ADDITIVE_RANK_WEIGHTS = {
  page: { tier1: 30, tier2: 20, tier3: 10, annexure: 0 },
  section: { primary: 25, fallback: 10, wrong: 0 },
  alias: { direct: 20, alias: 15, weak: 5 },
  tenderType: 15,
  validation: { valid: 30, review: 10, reject: 0 },
  source: { ai: 10, rule: 15, aiRule: 25 },
  aiVerificationMax: 10,
} as const;

const INCOMPLETE_VALUE_RX =
  /^(?:\d{1,2}-|\d{1,2}\/\d{0,2}$|technical|financial|commercial|pending|tbd|xxx)$/i;

function isIncompleteValue(value: string): boolean {
  const v = String(value || '').trim();
  if (!v || v.length < 2) return true;
  if (INCOMPLETE_VALUE_RX.test(v)) return true;
  if (/^\d{1,2}[-/]$/.test(v)) return true;
  if (v.length <= 12 && !/\d{4}/.test(v) && /\b(date|period|amount|value)\b/i.test(v)) return false;
  return false;
}

export function standardParameterGroupKey(row: TenderParameterCandidateRow): string {
  if (row.canonicalKey) return `core:${row.canonicalKey}`;
  const label = row.normalizedParameter || row.parameter;
  return `std:${normalizeAliasKey(label)}`;
}

function inferExtractionSource(row: TenderParameterCandidateRow): 'AI' | 'RULE' | 'AI+RULE' {
  const method = row.aliasMatchMethod;
  if (method === 'exact_canonical' || method === 'exact_alias') return 'AI+RULE';
  if (row.aliasMapped && (row.aliasMatchScore ?? 0) >= 85) return 'AI+RULE';
  if (row.aliasMapped) return 'AI+RULE';
  if ((row as { extractionSource?: string }).extractionSource === 'RULE') return 'RULE';
  return 'AI';
}

function scoreSourcePoints(source: 'AI' | 'RULE' | 'AI+RULE'): number {
  if (source === 'AI+RULE') return ADDITIVE_RANK_WEIGHTS.source.aiRule;
  if (source === 'RULE') return ADDITIVE_RANK_WEIGHTS.source.rule;
  return ADDITIVE_RANK_WEIGHTS.source.ai;
}

function scoreAliasPoints(row: TenderParameterCandidateRow): number {
  const original = normalizeAliasKey(row.originalLabel || row.parameter);
  const param = normalizeAliasKey(row.parameter);

  if (original === param && !row.aliasMapped) return ADDITIVE_RANK_WEIGHTS.alias.direct;
  if (row.aliasMatchMethod === 'exact_canonical' || row.aliasMatchMethod === 'exact_alias') {
    return ADDITIVE_RANK_WEIGHTS.alias.direct;
  }
  if (row.aliasMapped && (row.aliasMatchScore ?? 0) >= 80) return ADDITIVE_RANK_WEIGHTS.alias.alias;
  if (row.aliasMapped) return ADDITIVE_RANK_WEIGHTS.alias.weak;
  if (original === param) return ADDITIVE_RANK_WEIGHTS.alias.direct;
  return ADDITIVE_RANK_WEIGHTS.alias.weak;
}

function scorePagePoints(row: TenderParameterCandidateRow, pageText = ''): number {
  const analysis = resolvePagePriorityAnalysis(row.page, pageText, row.sourceText);
  if (analysis.isLowPrioritySection) return ADDITIVE_RANK_WEIGHTS.page.annexure;
  if (row.page <= 5) return ADDITIVE_RANK_WEIGHTS.page.tier1;
  if (row.page <= 20) return ADDITIVE_RANK_WEIGHTS.page.tier2;
  return ADDITIVE_RANK_WEIGHTS.page.tier3;
}

function scoreValidationPoints(row: TenderParameterCandidateRow): number {
  const status = row.validationStatus;
  const isCore = rowResolvesAsCoreParameter(row);

  if (isIncompleteValue(row.value) || isGarbageTenderParameterValue(row.value, { isCore })) {
    return ADDITIVE_RANK_WEIGHTS.validation.reject;
  }

  const strictKind = resolveStrictParameterKind(row.canonicalKey, row.parameter);
  if (strictKind) {
    const strict = validateStrictParameterValue(strictKind, row.value?.trim() || '', row.sourceText || '');
    if (strict.status === 'REJECT') return ADDITIVE_RANK_WEIGHTS.validation.reject;
    if (strict.status === 'REVIEW') return ADDITIVE_RANK_WEIGHTS.validation.review;
  }

  if (status === 'REJECT' || row.validationPassed === false) return ADDITIVE_RANK_WEIGHTS.validation.reject;
  if (status === 'REVIEW') return ADDITIVE_RANK_WEIGHTS.validation.review;
  if (status === 'VALID' || status === 'VALID_DYNAMIC_PARAMETER' || row.validationPassed === true) {
    return ADDITIVE_RANK_WEIGHTS.validation.valid;
  }

  if (isGenuineTenderParameterRow(row)) return ADDITIVE_RANK_WEIGHTS.validation.review;
  return ADDITIVE_RANK_WEIGHTS.validation.reject;
}

function scoreAiVerificationPoints(row: TenderParameterCandidateRow): number {
  const conf = row.validationConfidence ?? row.confidence ?? 0;
  return Math.min(ADDITIVE_RANK_WEIGHTS.aiVerificationMax, Math.round(conf / 10));
}

export function computeAdditiveRankScores(
  row: TenderParameterCandidateRow,
  opts?: {
    pageText?: string;
    pageClassifications?: PageSectionClassification[];
    tenderType?: string;
  }
): EnterpriseAdditiveRankScores {
  const extractionSource = inferExtractionSource(row);
  const pageScore = scorePagePoints(row, opts?.pageText);

  let sectionScore: number = ADDITIVE_RANK_WEIGHTS.section.wrong;
  if (opts?.pageClassifications?.length) {
    const sectionCheck = validateCandidateSectionAssignment(row, opts.pageClassifications);
    if (sectionCheck.matchType === 'primary') sectionScore = ADDITIVE_RANK_WEIGHTS.section.primary;
    else if (sectionCheck.matchType === 'fallback') sectionScore = ADDITIVE_RANK_WEIGHTS.section.fallback;
  } else if (row.sectionName) {
    sectionScore = ADDITIVE_RANK_WEIGHTS.section.fallback;
  }

  const aliasScore = scoreAliasPoints(row);
  const tenderTypeScore =
    opts?.tenderType && matchesTenderTypeLibraryParameter(row.parameter, opts.tenderType)
      ? ADDITIVE_RANK_WEIGHTS.tenderType
      : 0;
  const validationScore = scoreValidationPoints(row);
  const sourceScore = scoreSourcePoints(extractionSource);
  const aiVerificationScore = scoreAiVerificationPoints(row);

  const total =
    pageScore +
    sectionScore +
    aliasScore +
    tenderTypeScore +
    validationScore +
    sourceScore +
    aiVerificationScore;

  return {
    pageScore,
    sectionScore,
    aliasScore,
    tenderTypeScore,
    validationScore,
    sourceScore,
    aiVerificationScore,
    total,
    extractionSource,
  };
}

export function compareByAdditiveRankScore(
  a: Pick<TenderParameterCandidateRow, 'rankScore' | 'page' | 'confidence'>,
  b: Pick<TenderParameterCandidateRow, 'rankScore' | 'page' | 'confidence'>
): number {
  const scoreA = a.rankScore ?? 0;
  const scoreB = b.rankScore ?? 0;
  if (scoreB !== scoreA) return scoreB - scoreA;
  if (a.page !== b.page) return a.page - b.page;
  return (b.confidence ?? 0) - (a.confidence ?? 0);
}

export function toRankedParameterOutput(row: EnterpriseRankedCandidate): EnterpriseRankedParameterOutput {
  const breakdown =
    row.rankBreakdown && 'pageScore' in row.rankBreakdown
      ? (row.rankBreakdown as EnterpriseAdditiveRankScores)
      : undefined;
  const source = breakdown?.extractionSource ?? inferExtractionSource(row);

  return {
    parameter: row.parameter,
    value: row.value,
    confidence: Math.min(100, row.rankScore ?? row.confidence ?? 0),
    source,
    page: row.page,
    rankScore: row.rankScore ?? 0,
    canonicalKey: row.canonicalKey,
    rankBreakdown: breakdown,
  };
}

export function rankAndDeduplicateCandidates(
  candidates: TenderParameterCandidateRow[],
  pages: PageText[] = [],
  pageClassifications: PageSectionClassification[] = [],
  opts?: { tenderType?: string }
): EnterpriseCandidateRankingResult {
  const pageMap = new Map(pages.map((p) => [p.pageNumber, p.text || '']));

  const scored: EnterpriseRankedCandidate[] = candidates.map((row) => {
    const pageText = pageMap.get(row.page) || '';
    const additive = computeAdditiveRankScores(row, {
      pageText,
      pageClassifications,
      tenderType: opts?.tenderType,
    });
    const pageAnalysis = resolvePagePriorityAnalysis(row.page, pageText, row.sourceText);
    const rejected =
      additive.validationScore === 0 &&
      (isIncompleteValue(row.value) ||
        isGarbageTenderParameterValue(row.value, { isCore: rowResolvesAsCoreParameter(row) }));

    return {
      ...row,
      pagePriority: row.pagePriority ?? pageAnalysis.pagePriority,
      priorityTier: row.priorityTier ?? pageAnalysis.priorityTier,
      sourceSection: row.sourceSection ?? pageAnalysis.sourceSection,
      rankScore: rejected ? 0 : additive.total,
      rankBreakdown: additive,
      rankReason: rejected
        ? `Rejected: incomplete or invalid value "${row.value}"`
        : `Additive rank score ${additive.total}`,
      rankWinner: false,
      selectedValue: row.value,
    };
  });

  const rejected: EnterpriseRankedCandidate[] = [];
  const eligible: EnterpriseRankedCandidate[] = [];
  for (const row of scored) {
    if (isIncompleteValue(row.value)) {
      rejected.push(row);
    } else {
      eligible.push(row);
    }
  }

  const groups = new Map<string, EnterpriseRankedCandidate[]>();
  for (const row of eligible) {
    const key = standardParameterGroupKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const winners: EnterpriseRankedCandidate[] = [];
  const losers: EnterpriseRankedCandidate[] = [];
  const selections: EnterpriseRankingSelection[] = [];

  for (const [, group] of groups) {
    group.sort(compareByAdditiveRankScore);
    const winner = {
      ...group[0],
      rankWinner: true,
      rankReason: `Selected highest ranked candidate (score ${group[0].rankScore}) among ${group.length} duplicate(s) for ${group[0].parameter}`,
    };
    winners.push(winner);

    const groupLosers = group.slice(1).map((loser) => ({
      ...loser,
      rankWinner: false,
      rankReason: `Not selected: lower rank score (${loser.rankScore ?? 0} vs ${winner.rankScore ?? 0})`,
    }));
    losers.push(...groupLosers);

    selections.push({
      parameter: winner.parameter,
      canonicalKey: winner.canonicalKey,
      selectedValue: winner.value,
      rankingScore: winner.rankScore ?? 0,
      page: winner.page,
      reason: winner.rankReason,
      sourceText: winner.sourceText,
      winner,
      rejectedCandidates: groupLosers,
    });
  }

  winners.sort((a, b) => a.page - b.page || a.parameter.localeCompare(b.parameter));

  return {
    selections,
    winners,
    rejected,
    losers,
    stats: {
      inputCount: candidates.length,
      winnerCount: winners.length,
      rejectedByContext: rejected.length,
      rejectedBySpecialRule: 0,
      duplicateGroups: groups.size,
    },
  };
}

export function filterMasterDatasetRankingWinners(
  candidates: TenderParameterCandidateRow[]
): TenderParameterCandidateRow[] {
  const hasExplicitRanking = candidates.some((c) => c.rankWinner === true || c.rankWinner === false);
  if (!hasExplicitRanking) return candidates;
  return candidates.filter((c) => c.rankWinner !== false);
}

export function getEnterpriseCandidateRankingDuplicateSummary() {
  return {
    engine: 'enterprise_candidate_ranking_duplicate_removal',
    formula:
      'Final Score = Page + Section + Alias + Tender-Type + Validation + Source + AI Verification',
    weights: ADDITIVE_RANK_WEIGHTS,
    duplicatePolicy: 'Normalize via alias/canonical key → group → keep highest additive score',
    outputExample: {
      parameter: 'Tender Value',
      value: '₹2.5 Crore',
      confidence: 95,
      source: 'AI+RULE',
      page: 1,
    },
    inputSources: ['AI Extraction', 'Rule-Based Extraction', 'Tender-Type Libraries', 'Alias Engine'],
  };
}
