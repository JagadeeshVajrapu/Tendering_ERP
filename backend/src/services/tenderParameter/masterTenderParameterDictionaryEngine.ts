import { MasterDatasetKey } from '../../types/masterDataset';
import { MasterParameterGroup } from '../../types/masterTenderParameterDictionary';
import {
  MASTER_TENDER_PARAMETER_DICTIONARY,
  NIT_ALLOWED_DATASET_KEYS,
  NIT_PARAMETER_GROUP_ORDER,
} from './masterTenderParameterDictionary';

const allowedKeySet = new Set<string>(NIT_ALLOWED_DATASET_KEYS);
const canonicalByKey = new Map<MasterDatasetKey, string>();
const keyByCanonical = new Map<string, MasterDatasetKey>();
const groupByKey = new Map<MasterDatasetKey, MasterParameterGroup>();

for (const def of MASTER_TENDER_PARAMETER_DICTIONARY) {
  canonicalByKey.set(def.canonicalKey, def.canonical);
  keyByCanonical.set(normalizeParamName(def.canonical), def.canonicalKey);
  groupByKey.set(def.canonicalKey, def.group);
}

export function normalizeParamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[:\-–—]+/g, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNitAllowedDatasetKey(key: string): key is MasterDatasetKey {
  return allowedKeySet.has(key);
}

export function isAllowedMasterParameter(parameter: string, canonicalKey?: string): boolean {
  if (canonicalKey && isNitAllowedDatasetKey(canonicalKey)) return true;
  const norm = normalizeParamName(parameter);
  return keyByCanonical.has(norm);
}

export function resolveDictionaryKey(parameter: string, canonicalKey?: string): MasterDatasetKey | null {
  if (canonicalKey && isNitAllowedDatasetKey(canonicalKey)) return canonicalKey;
  return keyByCanonical.get(normalizeParamName(parameter)) ?? null;
}

export function getDictionaryCanonicalLabel(key: MasterDatasetKey): string {
  return canonicalByKey.get(key) || key;
}

export function getDictionaryGroup(key: MasterDatasetKey): MasterParameterGroup | undefined {
  return groupByKey.get(key);
}

/** Normalize a label to the dictionary canonical display name, or null if not in dictionary. */
export function normalizeToDictionaryCanonical(
  parameter: string,
  canonicalKey?: string
): { key: MasterDatasetKey; canonical: string; group: MasterParameterGroup } | null {
  const key = resolveDictionaryKey(parameter, canonicalKey);
  if (!key) return null;
  const group = groupByKey.get(key);
  if (!group) return null;
  return { key, canonical: getDictionaryCanonicalLabel(key), group };
}

export function filterToAllowedParameters<
  T extends { parameter: string; canonicalKey?: string },
>(rows: T[]): T[] {
  return rows.filter((row) => isAllowedMasterParameter(row.parameter, row.canonicalKey));
}

export function rejectNonDictionaryParameters<
  T extends { parameter: string; canonicalKey?: string; value?: string; page?: number },
>(rows: T[]): { accepted: T[]; rejected: T[] } {
  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const row of rows) {
    if (isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
      accepted.push(row);
    } else {
      rejected.push(row);
    }
  }
  return { accepted, rejected };
}

export function getNitParametersByGroup(): { group: MasterParameterGroup; keys: MasterDatasetKey[] }[] {
  return NIT_PARAMETER_GROUP_ORDER.map((group) => ({
    group,
    keys: MASTER_TENDER_PARAMETER_DICTIONARY.filter((d) => d.group === group).map((d) => d.canonicalKey),
  }));
}

export function getAllDictionaryCanonicals(): string[] {
  return MASTER_TENDER_PARAMETER_DICTIONARY.map((d) => d.canonical);
}
