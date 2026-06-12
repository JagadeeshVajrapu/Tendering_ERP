import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { TenderIntelligenceType } from '../../types/tenderIntelligenceLayer';
import {
  EnterpriseAliasMatchResult,
  EnterpriseAliasNormalizationStats,
  MasterAliasRegistryEntry,
} from '../../types/enterpriseTenderAlias';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { MASTER_ALIAS_REGISTRY } from './masterAliasRegistry';
import { normalizeToDictionaryCanonical } from './masterTenderParameterDictionaryEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'and', 'or', 'in', 'on', 'at', 'to', 'is', 'are', 'was', 'be',
  'requirement', 'required', 'applicable', 'date', 'amount', 'value', 'no', 'number',
]);

export function normalizeAliasKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[:\-–—.]+/g, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(label: string): Set<string> {
  const tokens = normalizeAliasKey(label)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function buildAliasLookups(registry: MasterAliasRegistryEntry[]) {
  const exactLookup = new Map<string, MasterAliasRegistryEntry>();
  const aliasToEntry = new Map<string, { entry: MasterAliasRegistryEntry; isCanonical: boolean }>();

  for (const entry of registry) {
    const canonNorm = normalizeAliasKey(entry.standardParameter);
    exactLookup.set(canonNorm, entry);
    aliasToEntry.set(canonNorm, { entry, isCanonical: true });

    for (const alias of entry.aliases) {
      const norm = normalizeAliasKey(alias);
      if (!aliasToEntry.has(norm)) {
        aliasToEntry.set(norm, { entry, isCanonical: false });
      }
    }
  }

  return { exactLookup, aliasToEntry };
}

const { aliasToEntry } = buildAliasLookups(MASTER_ALIAS_REGISTRY);

function scoreSemanticMatch(
  norm: string,
  tokens: Set<string>,
  entry: MasterAliasRegistryEntry
): number {
  const semanticTokens = entry.semanticTokens ?? [];
  if (!semanticTokens.length) return 0;

  const entryTokens = new Set(semanticTokens.map((t) => normalizeAliasKey(t)));
  const overlap = jaccardSimilarity(tokens, entryTokens);
  if (overlap < 0.45) return 0;

  const labelHasSemantic = semanticTokens.some((t) => norm.includes(normalizeAliasKey(t)));
  if (!labelHasSemantic && overlap < 0.6) return 0;

  return Math.round(80 + overlap * 10);
}

function scoreFuzzyAliasMatch(tokens: Set<string>, entry: MasterAliasRegistryEntry): number {
  let best = 0;
  for (const alias of [entry.standardParameter, ...entry.aliases]) {
    const aliasTokens = tokenize(alias);
    const sim = jaccardSimilarity(tokens, aliasTokens);
    if (sim > best) best = sim;
  }
  if (best >= 0.75) return 90;
  if (best >= 0.6) return 85;
  if (best >= 0.5) return 80;
  return 0;
}

function matchPattern(originalLabel: string, norm: string, entry: MasterAliasRegistryEntry): boolean {
  if (!entry.patterns?.length) return false;
  return entry.patterns.some((p) => p.test(originalLabel) || p.test(norm));
}

function entryAppliesToContext(
  entry: MasterAliasRegistryEntry,
  opts?: { serviceCategory?: TenderServiceCategory | ''; tenderType?: TenderIntelligenceType | '' }
): boolean {
  if (opts?.serviceCategory && entry.serviceCategories?.length) {
    if (!entry.serviceCategories.includes(opts.serviceCategory as TenderServiceCategory)) return false;
  }
  if (opts?.tenderType && entry.tenderTypes?.length) {
    if (!entry.tenderTypes.includes(opts.tenderType)) return false;
  }
  return true;
}

function pickBestEntry(
  candidates: Array<{ entry: MasterAliasRegistryEntry; score: number; method: EnterpriseAliasMatchResult['matchMethod'] }>
): { entry: MasterAliasRegistryEntry; score: number; method: EnterpriseAliasMatchResult['matchMethod'] } | null {
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.priority - a.entry.priority;
  });
  return candidates[0];
}

/**
 * Enterprise Tender Alias Engine — normalize any tender label to a standard parameter name.
 */
export function resolveEnterpriseAlias(
  rawLabel: string,
  opts?: { serviceCategory?: TenderServiceCategory | ''; tenderType?: TenderIntelligenceType | '' }
): EnterpriseAliasMatchResult {
  const originalParameter = String(rawLabel || '').trim();
  if (!originalParameter) {
    return {
      originalParameter: '',
      normalizedParameter: '',
      canonicalKey: '',
      aliasMatched: false,
      confidence: 0,
      matchMethod: 'none',
      aliasMatchScore: 0,
    };
  }

  const norm = normalizeAliasKey(originalParameter);
  const tokens = tokenize(originalParameter);

  const exactHit = aliasToEntry.get(norm);
  if (exactHit && entryAppliesToContext(exactHit.entry, opts)) {
    const score = exactHit.isCanonical ? 99 : 95;
    return buildMatchResult(originalParameter, exactHit.entry, score, exactHit.isCanonical ? 'exact_canonical' : 'exact_alias');
  }

  const patternCandidates: Array<{
    entry: MasterAliasRegistryEntry;
    score: number;
    method: EnterpriseAliasMatchResult['matchMethod'];
  }> = [];

  for (const entry of MASTER_ALIAS_REGISTRY) {
    if (!entryAppliesToContext(entry, opts)) continue;

    if (matchPattern(originalParameter, norm, entry)) {
      patternCandidates.push({ entry, score: 90, method: 'pattern' });
      continue;
    }

    const semanticScore = scoreSemanticMatch(norm, tokens, entry);
    if (semanticScore >= 80) {
      patternCandidates.push({ entry, score: semanticScore, method: 'semantic' });
      continue;
    }

    const fuzzyScore = scoreFuzzyAliasMatch(tokens, entry);
    if (fuzzyScore >= 80) {
      patternCandidates.push({ entry, score: fuzzyScore, method: 'semantic' });
    }
  }

  const best = pickBestEntry(patternCandidates);
  if (best) {
    return buildMatchResult(originalParameter, best.entry, best.score, best.method);
  }

  return {
    originalParameter,
    normalizedParameter: originalParameter,
    canonicalKey: '',
    aliasMatched: false,
    confidence: 0,
    matchMethod: 'none',
    aliasMatchScore: 0,
  };
}

function buildMatchResult(
  originalParameter: string,
  entry: MasterAliasRegistryEntry,
  score: number,
  method: EnterpriseAliasMatchResult['matchMethod']
): EnterpriseAliasMatchResult {
  const dict = entry.canonicalKey
    ? normalizeToDictionaryCanonical(entry.standardParameter, entry.canonicalKey)
    : null;

  const normalizedParameter = entry.standardParameter;
  const canonicalKey = dict?.key ?? entry.canonicalKey ?? '';
  const aliasMatched =
    normalizeAliasKey(originalParameter) !== normalizeAliasKey(normalizedParameter);

  return {
    originalParameter,
    normalizedParameter,
    canonicalKey,
    aliasMatched,
    confidence: score,
    matchMethod: method,
    aliasMatchScore: score,
    category: entry.category,
  };
}

export function normalizeCandidateWithEnterpriseAlias<
  T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
>(row: T, opts?: { serviceCategory?: TenderServiceCategory | ''; tenderType?: TenderIntelligenceType | '' }): TenderParameterCandidateRow {
  const match = resolveEnterpriseAlias(row.parameter, opts);
  const parameter = match.normalizedParameter;
  const canonicalKey = match.canonicalKey || undefined;

  return {
    ...row,
    parameter,
    originalLabel: match.originalParameter,
    normalizedParameter: parameter,
    canonicalKey,
    aliasMapped: match.aliasMatched,
    aliasMatchScore: match.aliasMatchScore,
    aliasMatchMethod: match.matchMethod as TenderParameterCandidateRow['aliasMatchMethod'],
    isCoreParameter:
      (row as { isCoreParameter?: boolean }).isCoreParameter ??
      isAllowedMasterParameter(parameter, canonicalKey),
    category: (row as { category?: string }).category ?? match.category,
  };
}

export function applyEnterpriseAliasToCandidates<
  T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
>(candidates: T[], opts?: { serviceCategory?: TenderServiceCategory | ''; tenderType?: TenderIntelligenceType | '' }): {
  candidates: TenderParameterCandidateRow[];
  stats: EnterpriseAliasNormalizationStats;
} {
  const normalized = candidates.map((row) => normalizeCandidateWithEnterpriseAlias(row, opts));

  const stats: EnterpriseAliasNormalizationStats = {
    inputCount: candidates.length,
    aliasMatchedCount: normalized.filter((r) => r.aliasMapped).length,
    exactAliasCount: normalized.filter((r) => r.aliasMatchMethod === 'exact_alias' || r.aliasMatchMethod === 'exact_canonical').length,
    semanticMatchCount: normalized.filter((r) => r.aliasMatchMethod === 'semantic' || r.aliasMatchMethod === 'pattern').length,
    unmappedCount: normalized.filter((r) => !r.aliasMapped).length,
  };

  return { candidates: normalized, stats };
}

export function getMasterAliasRegistrySummary() {
  return {
    count: MASTER_ALIAS_REGISTRY.length,
    totalAliases: MASTER_ALIAS_REGISTRY.reduce((n, e) => n + e.aliases.length, 0),
    entries: MASTER_ALIAS_REGISTRY.map((e) => ({
      standardParameter: e.standardParameter,
      canonicalKey: e.canonicalKey ?? null,
      category: e.category,
      serviceCategories: e.serviceCategories ?? [],
      tenderTypes: e.tenderTypes ?? [],
      priority: e.priority,
      aliasCount: e.aliases.length,
      aliases: e.aliases,
    })),
  };
}
