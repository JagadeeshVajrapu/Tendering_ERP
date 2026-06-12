import { DiscoveredParameterLearning } from '../../models/DiscoveredParameterLearning';
import { DiscoveredParameterLearningEntry } from '../../types/enterpriseDynamicParameterDiscovery';
import { normalizeParamName } from './masterTenderParameterDictionaryEngine';
import { normalizeAliasKey } from './tenderParameterAliasEngine';
import { DYNAMIC_PARAMETER_REGISTRY } from '../../foundation/masterParameterRegistry';

export const PROMOTION_FREQUENCY_THRESHOLD = 50;

function toEntry(doc: {
  parameterKey: string;
  parameterName: string;
  category: string;
  serviceCategories?: string[];
  frequency: number;
  examples?: string[];
  aliasSuggestions?: string[];
  promotedToCore: boolean;
  promotedAt?: Date;
  lastSeenAt: Date;
}): DiscoveredParameterLearningEntry {
  return {
    parameterKey: doc.parameterKey,
    parameterName: doc.parameterName,
    category: doc.category,
    serviceCategories: doc.serviceCategories ?? [],
    frequency: doc.frequency,
    examples: doc.examples ?? [],
    aliasSuggestions: doc.aliasSuggestions ?? [],
    promotedToCore: doc.promotedToCore,
    promotedAt: doc.promotedAt?.toISOString(),
    lastSeenAt: doc.lastSeenAt.toISOString(),
  };
}

export function buildParameterLearningKey(parameter: string): string {
  return normalizeParamName(parameter).replace(/\s+/g, '_');
}

export function matchStaticDynamicRegistry(parameter: string): boolean {
  const key = normalizeAliasKey(parameter);
  return DYNAMIC_PARAMETER_REGISTRY.some(
    (e) =>
      normalizeAliasKey(e.name) === key ||
      e.aliases.some((a) => normalizeAliasKey(a) === key)
  );
}

export async function recordDiscoveredParameter(opts: {
  parameter: string;
  originalLabel?: string;
  value: string;
  category: string;
  serviceCategory?: string;
}): Promise<DiscoveredParameterLearningEntry> {
  const parameterKey = buildParameterLearningKey(opts.parameter);
  const aliasLabel = opts.originalLabel?.trim();
  const aliasSuggestions = aliasLabel && normalizeAliasKey(aliasLabel) !== normalizeAliasKey(opts.parameter)
    ? [aliasLabel]
    : [];

  const existing = await DiscoveredParameterLearning.findOne({ parameterKey });
  if (existing) {
    existing.frequency += 1;
    existing.lastSeenAt = new Date();
    existing.category = opts.category || existing.category;
    if (opts.serviceCategory && !existing.serviceCategories.includes(opts.serviceCategory)) {
      existing.serviceCategories.push(opts.serviceCategory);
    }
    if (opts.value && existing.examples.length < 20 && !existing.examples.includes(opts.value)) {
      existing.examples.push(opts.value.slice(0, 200));
    }
    for (const alias of aliasSuggestions) {
      if (!existing.aliasSuggestions.includes(alias)) existing.aliasSuggestions.push(alias);
    }
    if (existing.frequency >= PROMOTION_FREQUENCY_THRESHOLD && !existing.promotedToCore) {
      existing.promotedToCore = true;
      existing.promotedAt = new Date();
    }
    await existing.save();
    return toEntry(existing);
  }

  const created = await DiscoveredParameterLearning.create({
    parameterKey,
    parameterName: opts.parameter,
    category: opts.category,
    serviceCategories: opts.serviceCategory ? [opts.serviceCategory] : [],
    frequency: 1,
    examples: opts.value ? [opts.value.slice(0, 200)] : [],
    aliasSuggestions,
    promotedToCore: false,
    lastSeenAt: new Date(),
  });
  return toEntry(created);
}

export async function findLearningEntry(parameter: string): Promise<DiscoveredParameterLearningEntry | null> {
  const doc = await DiscoveredParameterLearning.findOne({
    parameterKey: buildParameterLearningKey(parameter),
  }).lean();
  return doc ? toEntry({ ...doc, lastSeenAt: doc.lastSeenAt ?? doc.updatedAt }) : null;
}

export async function getPromotedParameters(): Promise<DiscoveredParameterLearningEntry[]> {
  const docs = await DiscoveredParameterLearning.find({ promotedToCore: true })
    .sort({ frequency: -1 })
    .lean();
  return docs.map((d) => toEntry({ ...d, lastSeenAt: d.lastSeenAt ?? d.updatedAt }));
}

export async function getLearningRegistrySummary(limit = 100) {
  const entries = await DiscoveredParameterLearning.find()
    .sort({ frequency: -1 })
    .limit(limit)
    .lean();
  return {
    total: await DiscoveredParameterLearning.countDocuments(),
    promotedCount: await DiscoveredParameterLearning.countDocuments({ promotedToCore: true }),
    promotionThreshold: PROMOTION_FREQUENCY_THRESHOLD,
    entries: entries.map((d) => toEntry({ ...d, lastSeenAt: d.lastSeenAt ?? d.updatedAt })),
  };
}
