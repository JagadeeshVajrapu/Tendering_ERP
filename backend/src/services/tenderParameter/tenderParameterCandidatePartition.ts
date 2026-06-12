import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { applyAliasMappingToCandidates } from './tenderParameterAliasEngine';
import {
  filterToAllowedParameters,
  normalizeToDictionaryCanonical,
} from './masterTenderParameterDictionaryEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';

export interface PartitionedCandidates {
  core: TenderParameterCandidateRow[];
  dynamic: TenderParameterCandidateRow[];
  rejectedByDictionary: TenderParameterCandidateRow[];
}

/**
 * After alias mapping, split into core (dictionary) and dynamic (non-dictionary) candidates.
 */
export function partitionCoreAndDynamicCandidates<
  T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
>(candidates: T[]): PartitionedCandidates {
  const aliasMapped = applyAliasMappingToCandidates(candidates);

  const core: TenderParameterCandidateRow[] = [];
  const dynamic: TenderParameterCandidateRow[] = [];
  const rejectedByDictionary: TenderParameterCandidateRow[] = [];

  for (const row of aliasMapped) {
    const dict = normalizeToDictionaryCanonical(row.parameter, row.canonicalKey);
    if (dict) {
      core.push({
        ...row,
        parameter: dict.canonical,
        canonicalKey: dict.key,
        aliasMapped: row.aliasMapped || row.parameter !== dict.canonical,
      });
      continue;
    }

    if (isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
      const normalized = filterToAllowedParameters([row])[0];
      if (normalized) core.push(normalized);
      else rejectedByDictionary.push(row);
      continue;
    }

    dynamic.push({
      ...row,
      canonicalKey: undefined,
    });
  }

  return { core, dynamic, rejectedByDictionary };
}
