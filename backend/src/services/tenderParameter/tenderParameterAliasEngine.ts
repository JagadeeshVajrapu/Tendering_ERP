import { TenderParameterAliasDefinition, TenderParameterAliasMatch } from '../../types/tenderParameterAlias';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import {
  applyEnterpriseAliasToCandidates,
  normalizeAliasKey,
  resolveEnterpriseAlias,
} from './enterpriseTenderAliasEngine';
import { MASTER_ALIAS_REGISTRY, toLegacyAliasCatalogDefinitions } from './masterAliasRegistry';
import {
  filterToAllowedParameters,
  normalizeToDictionaryCanonical,
} from './masterTenderParameterDictionaryEngine';

/** @deprecated Import MASTER_ALIAS_REGISTRY — kept for backward compatibility */
export const TENDER_PARAMETER_ALIAS_CATALOG: TenderParameterAliasDefinition[] =
  toLegacyAliasCatalogDefinitions();

export { normalizeAliasKey };

function toLegacyMatch(rawLabel: string, serviceCategory?: TenderServiceCategory | ''): TenderParameterAliasMatch {
  const match = resolveEnterpriseAlias(rawLabel, { serviceCategory });
  return {
    parameter: match.normalizedParameter,
    originalLabel: match.originalParameter,
    normalizedParameter: match.normalizedParameter,
    canonicalKey: match.canonicalKey,
    mapped: match.aliasMatched,
    aliasMatched: match.aliasMatched,
    confidence: match.confidence,
    aliasMatchScore: match.aliasMatchScore,
    matchMethod: match.matchMethod,
    category: match.category,
  };
}

/**
 * Map a raw extracted label to its canonical Master Parameter Dictionary name.
 * Preserves originalLabel for audit.
 */
export function mapParameterAlias(
  rawLabel: string,
  opts?: { serviceCategory?: TenderServiceCategory | '' }
): TenderParameterAliasMatch {
  return toLegacyMatch(rawLabel, opts?.serviceCategory);
}

/** Enterprise alias normalization — runs before ranking and validation. */
export function applyAliasMappingToCandidates<
  T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
>(candidates: T[], opts?: { serviceCategory?: TenderServiceCategory | '' }): TenderParameterCandidateRow[] {
  return applyEnterpriseAliasToCandidates(candidates, opts).candidates;
}

/**
 * Full pipeline: raw AI labels → alias canonical names → dictionary whitelist.
 */
export function normalizeAliasMapAndValidateCandidates<
  T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
>(candidates: T[], opts?: { serviceCategory?: TenderServiceCategory | '' }): {
  candidates: TenderParameterCandidateRow[];
  aliasMapped: TenderParameterCandidateRow[];
  rejectedByDictionary: TenderParameterCandidateRow[];
} {
  const { candidates: aliasMapped } = applyEnterpriseAliasToCandidates(candidates, opts);
  const dictionary = filterToAllowedParameters(aliasMapped).map((row) => {
    const dict = normalizeToDictionaryCanonical(row.parameter, row.canonicalKey);
    if (!dict) return row;
    return { ...row, parameter: dict.canonical, canonicalKey: dict.key };
  });

  const dictKeys = new Set(dictionary.map((r) => `${r.page}|${r.canonicalKey}|${r.value}`));
  const rejectedByDictionary = aliasMapped.filter(
    (row) => !dictKeys.has(`${row.page}|${row.canonicalKey}|${row.value}`)
  );

  return { candidates: dictionary, aliasMapped, rejectedByDictionary };
}

export { MASTER_ALIAS_REGISTRY };
