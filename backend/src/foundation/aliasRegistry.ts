import { AliasRegistryEntry } from '../types/foundationLayer';
import { MASTER_ALIAS_REGISTRY } from '../services/tenderParameter/masterAliasRegistry';

/**
 * Part 4 — Unified Alias Registry.
 * Unlimited aliases: extend TENDER_PARAMETER_ALIAS_CATALOG or DOCUMENTED_ALIAS_EXAMPLES.
 */
export function buildAliasRegistry(): AliasRegistryEntry[] {
  const entries: AliasRegistryEntry[] = [];
  const seen = new Set<string>();

  const add = (alias: string, canonical: string, canonicalKey?: string) => {
    const norm = alias.toLowerCase().trim();
    if (!norm || seen.has(`${norm}|${canonical}`)) return;
    seen.add(`${norm}|${canonical}`);
    entries.push({ alias, canonical, canonicalKey: canonicalKey as AliasRegistryEntry['canonicalKey'] });
  };

  for (const entry of MASTER_ALIAS_REGISTRY) {
    add(entry.standardParameter, entry.standardParameter, entry.canonicalKey);
    for (const alias of entry.aliases) add(alias, entry.standardParameter, entry.canonicalKey);
  }

  return entries;
}

export const ALIAS_REGISTRY = buildAliasRegistry();

export function lookupAlias(alias: string): AliasRegistryEntry | undefined {
  const norm = alias.toLowerCase().replace(/[:\-–—.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIAS_REGISTRY.find(
    (e) =>
      e.alias.toLowerCase().replace(/[:\-–—.]+/g, ' ').replace(/\s+/g, ' ').trim() === norm
  );
}

export function formatAliasRegistryForPrompt(limit = 40): string {
  const lines = ALIAS_REGISTRY.slice(0, limit).map((e) => `${e.alias} → ${e.canonical}`);
  return lines.join('\n');
}
