import { DynamicParameterRecord } from '../../types/dynamicParameter';
import { MappedBusinessField } from '../../types/parameterMapping';
import {
  normalizeParameterNameForMapping,
  resolveRuleForParameter,
} from './businessFieldMappingRegistry';

/**
 * Mapping Engine — maps discovered parameters to canonical master dataset fields.
 * One master field per key; highest confidence wins.
 */
export function mapDiscoveredParametersToMasterFields(
  parameters: DynamicParameterRecord[]
): MappedBusinessField[] {
  return mapDynamicParametersToBusinessFields(parameters);
}

/** @alias mapDiscoveredParametersToMasterFields */
export function mapDynamicParametersToBusinessFields(
  parameters: DynamicParameterRecord[]
): MappedBusinessField[] {
  const byMasterKey = new Map<string, MappedBusinessField>();

  for (const p of parameters) {
    const normalized = normalizeParameterNameForMapping(p.parameterName);
    const rule = resolveRuleForParameter(normalized);
    if (!rule || !p.parameterValue?.trim()) continue;

    const mapped: MappedBusinessField = {
      masterKey: rule.masterKey,
      businessFieldName: rule.businessFieldName,
      value: p.parameterValue.trim(),
      sourceParameterName: p.parameterName,
      sourcePage: p.sourcePage,
      confidence: p.confidence,
      sourceText: `${p.parameterName}: ${p.parameterValue}`,
      mappingRule: `${p.parameterName} → ${rule.businessFieldName}`,
    };

    const existing = byMasterKey.get(rule.masterKey);
    if (!existing) {
      byMasterKey.set(rule.masterKey, mapped);
      continue;
    }

    if (mapped.confidence > existing.confidence) {
      byMasterKey.set(rule.masterKey, mapped);
    } else if (mapped.confidence === existing.confidence && mapped.sourcePage < existing.sourcePage) {
      byMasterKey.set(rule.masterKey, mapped);
    }
  }

  return Array.from(byMasterKey.values()).sort((a, b) =>
    a.businessFieldName.localeCompare(b.businessFieldName)
  );
}
