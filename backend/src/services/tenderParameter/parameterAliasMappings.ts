import { MasterDatasetKey } from '../../types/masterDataset';
import { MASTER_ALIAS_REGISTRY } from './masterAliasRegistry';
import { normalizeAliasKey } from './enterpriseTenderAliasEngine';

/** Core alias groups for AI prompt hints (derived from master registry). */
export const DOCUMENTED_ALIAS_EXAMPLES = MASTER_ALIAS_REGISTRY.filter((e) => e.canonicalKey)
  .slice(0, 12)
  .map((entry) => ({
    canonical: entry.standardParameter,
    canonicalKey: entry.canonicalKey as MasterDatasetKey,
    aliases: entry.aliases.filter(
      (a) => normalizeAliasKey(a) !== normalizeAliasKey(entry.standardParameter)
    ),
  }));

/** Flat lookup: normalized alias label → canonical dictionary name */
export function buildPrimaryAliasLookup(): Map<string, { canonical: string; canonicalKey: MasterDatasetKey }> {
  const map = new Map<string, { canonical: string; canonicalKey: MasterDatasetKey }>();

  for (const entry of MASTER_ALIAS_REGISTRY) {
    if (!entry.canonicalKey) continue;
    map.set(normalizeAliasKey(entry.standardParameter), {
      canonical: entry.standardParameter,
      canonicalKey: entry.canonicalKey,
    });
    for (const alias of entry.aliases) {
      map.set(normalizeAliasKey(alias), {
        canonical: entry.standardParameter,
        canonicalKey: entry.canonicalKey,
      });
    }
  }

  return map;
}

export function formatDocumentedAliasExamplesForPrompt(): string {
  return MASTER_ALIAS_REGISTRY.slice(0, 20)
    .map((e) => {
      const aliases = e.aliases
        .filter((a) => normalizeAliasKey(a) !== normalizeAliasKey(e.standardParameter))
        .slice(0, 6);
      return `${aliases.join(' / ')} → ${e.standardParameter}`;
    })
    .join('\n');
}
