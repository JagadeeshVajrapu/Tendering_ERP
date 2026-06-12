import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { TenderIntelligenceType } from '../../types/tenderIntelligenceLayer';
import {
  applyEnterpriseAliasToCandidates,
  getMasterAliasRegistrySummary,
  normalizeAliasKey,
  resolveEnterpriseAlias,
} from './enterpriseTenderAliasEngine';
import { MASTER_ALIAS_REGISTRY } from './masterAliasRegistry';
import { compareByAdditiveRankScore, standardParameterGroupKey } from './enterpriseCandidateRankingDuplicateEngine';

export interface AliasDictionaryEntry {
  standardParameter: string;
  alias: string;
  category: string;
  priority: number;
  tenderTypes: string[];
  canonicalKey?: string;
}

export interface DuplicateMergeResult {
  candidates: TenderParameterCandidateRow[];
  mergedGroups: number;
  removedDuplicates: number;
}

function standardParameterKey(row: TenderParameterCandidateRow): string {
  return standardParameterGroupKey(row);
}

function scoreCandidateForMerge(a: TenderParameterCandidateRow, b: TenderParameterCandidateRow): number {
  if (a.rankScore != null || b.rankScore != null) {
    return compareByAdditiveRankScore(a, b);
  }
  return compareByAdditiveRankScore(
    { ...a, rankScore: a.pagePriority ?? 0 },
    { ...b, rankScore: b.pagePriority ?? 0 }
  );
}

/**
 * After alias normalization, collapse duplicate rows for the same standard parameter.
 * Keeps the best value by page priority, rank score, and confidence.
 */
export function mergeDuplicateStandardParameters(
  candidates: TenderParameterCandidateRow[]
): DuplicateMergeResult {
  const groups = new Map<string, TenderParameterCandidateRow[]>();

  for (const row of candidates) {
    const key = standardParameterKey(row);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  const merged: TenderParameterCandidateRow[] = [];
  let removedDuplicates = 0;
  let mergedGroups = 0;

  for (const [, group] of groups) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    mergedGroups += 1;
    group.sort(scoreCandidateForMerge);
    const winner = {
      ...group[0],
      rankReason:
        group[0].rankReason ||
        `Selected best value among ${group.length} alias variants for ${group[0].parameter}`,
    };
    merged.push(winner);
    removedDuplicates += group.length - 1;
  }

  merged.sort((a, b) => a.page - b.page || a.parameter.localeCompare(b.parameter));

  return { candidates: merged, mergedGroups, removedDuplicates };
}

/**
 * Normalize extracted labels → standard parameters, then deduplicate alias variants.
 */
export function normalizeCandidatesWithAliasDictionary(
  candidates: Array<{
    parameter: string;
    value: string;
    page: number;
    confidence: number;
    sourceText: string;
    category?: string;
    isCoreParameter?: boolean;
    pagePriority?: number;
    sourceSection?: string;
    sectionName?: string;
    sectionConfidence?: number;
  }>,
  opts?: { serviceCategory?: TenderServiceCategory | ''; tenderType?: TenderIntelligenceType | '' }
): {
  candidates: TenderParameterCandidateRow[];
  aliasStats: ReturnType<typeof applyEnterpriseAliasToCandidates>['stats'];
  duplicateMerge: DuplicateMergeResult;
} {
  const { candidates: aliasNormalized, stats } = applyEnterpriseAliasToCandidates(candidates, {
    serviceCategory: opts?.serviceCategory,
    tenderType: opts?.tenderType,
  });

  const withTypeBoost = aliasNormalized.map((row) => {
    if (!opts?.tenderType || !row.aliasMapped) return row;
    const entry = MASTER_ALIAS_REGISTRY.find(
      (e) =>
        e.standardParameter === row.parameter ||
        e.canonicalKey === row.canonicalKey ||
        normalizeAliasKey(e.standardParameter) === normalizeAliasKey(row.parameter)
    );
    if (entry?.tenderTypes?.length && entry.tenderTypes.includes(opts.tenderType)) {
      return {
        ...row,
        aliasMatchScore: Math.min(100, (row.aliasMatchScore ?? 0) + 5),
      };
    }
    return row;
  });

  const duplicateMerge = mergeDuplicateStandardParameters(withTypeBoost);

  return {
    candidates: duplicateMerge.candidates,
    aliasStats: stats,
    duplicateMerge,
  };
}

export function resolveToStandardParameter(
  rawLabel: string,
  opts?: { serviceCategory?: TenderServiceCategory | ''; tenderType?: TenderIntelligenceType | '' }
) {
  const match = resolveEnterpriseAlias(rawLabel, { serviceCategory: opts?.serviceCategory });
  return {
    originalLabel: rawLabel,
    standardParameter: match.normalizedParameter,
    canonicalKey: match.canonicalKey,
    category: match.category,
    aliasMatched: match.aliasMatched,
    matchMethod: match.matchMethod,
    confidence: match.confidence,
  };
}

export function flattenAliasDictionary(): AliasDictionaryEntry[] {
  const rows: AliasDictionaryEntry[] = [];
  for (const entry of MASTER_ALIAS_REGISTRY) {
    for (const alias of entry.aliases) {
      rows.push({
        standardParameter: entry.standardParameter,
        alias,
        category: entry.category,
        priority: entry.priority,
        tenderTypes: entry.tenderTypes ?? [],
        canonicalKey: entry.canonicalKey,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.standardParameter.localeCompare(b.standardParameter) ||
      a.alias.localeCompare(b.alias)
  );
}

export function formatAliasDictionaryForExtractionPrompt(limit = 60): string {
  const lines = MASTER_ALIAS_REGISTRY.slice(0, limit).flatMap((entry) => {
    const typeHint = entry.tenderTypes?.length ? ` [${entry.tenderTypes.join(', ')}]` : '';
    return entry.aliases.slice(0, 8).map((a) => `${a} → ${entry.standardParameter}${typeHint}`);
  });
  return `ENTERPRISE ALIAS DICTIONARY — map extracted labels to standard parameters:\n${lines.join('\n')}`;
}

export function getEnterpriseAliasDictionarySummary() {
  const registry = getMasterAliasRegistrySummary();
  return {
    engine: 'enterprise_alias_dictionary',
    structure: ['Standard Parameter', 'Alias', 'Category', 'Priority', 'Tender Type'],
    matchingLogic: 'Exact alias → Pattern → Semantic → map to standard parameter name',
    duplicatePolicy: 'Merge alias variants (EMD, EMD Amount, Earnest Money Deposit) → one standard parameter with best value',
    totalStandardParameters: registry.count,
    totalAliases: registry.totalAliases,
    entries: registry.entries,
    flatAliases: flattenAliasDictionary(),
    examples: [
      { alias: 'Earnest Money Deposit', standardParameter: 'EMD Amount', category: 'Financial' },
      { alias: 'Estimated Cost', standardParameter: 'Tender Value', category: 'Financial' },
      { alias: 'Last Date Of Submission', standardParameter: 'Bid End Date', category: 'Timeline' },
      { alias: 'GSTIN', standardParameter: 'GST', category: 'Compliance' },
    ],
  };
}

export { resolveEnterpriseAlias, applyEnterpriseAliasToCandidates, getMasterAliasRegistrySummary };
