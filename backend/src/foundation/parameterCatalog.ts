import { ParameterCatalogEntry } from '../types/foundationLayer';
import { MASTER_PARAMETER_REGISTRY } from './masterParameterRegistry';
import { VALIDATION_RULE_REGISTRY } from './validationRuleRegistry';

/**
 * Part 5 — Parameter Catalog with metadata for extraction, validation, and display.
 */
export function buildParameterCatalog(): ParameterCatalogEntry[] {
  return MASTER_PARAMETER_REGISTRY.map((param) => {
    const rules = VALIDATION_RULE_REGISTRY.filter(
      (r) =>
        (param.canonicalKey && r.parameterKeys?.includes(param.canonicalKey)) ||
        (param.type === 'dynamic' && r.id === 'dynamic_quality')
    );

    const nearLabels = rules.flatMap((r) => r.nearLabels ?? []);
    const forbiddenNear = rules.flatMap((r) => r.forbiddenNear ?? []);

    return {
      ...param,
      validationRules: rules.map((r) => r.id),
      nearLabels: nearLabels.length ? nearLabels : undefined,
      forbiddenNear: forbiddenNear.length ? forbiddenNear : undefined,
      examples: param.examples,
    };
  });
}

export const PARAMETER_CATALOG = buildParameterCatalog();

export function formatParameterCatalogForPrompt(
  serviceCategory?: string,
  maxDynamic = 15
): string {
  const core = PARAMETER_CATALOG.filter((p) => p.type === 'core');
  const dynamic = PARAMETER_CATALOG.filter(
    (p) =>
      p.type === 'dynamic' &&
      (!serviceCategory || !p.serviceCategories?.length || p.serviceCategories.some((c) => c === serviceCategory))
  ).slice(0, maxDynamic);

  const coreLines = core.map((p) => `  [core] ${p.name} (${p.category}) — aliases: ${p.aliases.slice(0, 4).join(', ') || 'none'}`);
  const dynamicLines = dynamic.map((p) => `  [dynamic] ${p.name} — type: ${p.valueType}`);

  return `CORE PARAMETERS:\n${coreLines.join('\n')}\n\nTYPICAL DYNAMIC PARAMETERS:\n${dynamicLines.join('\n')}`;
}
