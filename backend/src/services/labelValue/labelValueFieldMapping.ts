import { FieldLocatorFieldName } from '../../types/fieldLocator';
import { LabelValuePair } from '../../types/labelValuePair';

/** OCR label (normalized) → canonical Field Locator field */
export interface LabelFieldMappingRule {
  /** Normalized label aliases (lowercase, single spaces) */
  sourceLabels: string[];
  targetField: FieldLocatorFieldName;
  priority: number;
}

export const LABEL_TO_FIELD_MAPPINGS: LabelFieldMappingRule[] = [
  {
    sourceLabels: [
      'tender no',
      'tender number',
      'tender id',
      'nit number',
      'nit no',
      'bid reference no',
      'bid reference number',
      'reference no',
    ],
    targetField: 'Tender Number',
    priority: 1,
  },
  {
    sourceLabels: [
      'emd amount',
      'amount of emd',
      'emd value',
      'earnest money deposit',
      'earnest money',
      'bid security',
      'security deposit',
      'emd',
    ],
    targetField: 'EMD',
    priority: 2,
  },
  {
    sourceLabels: [
      'estimated tender value',
      'estimated cost of work',
      'estimated cost',
      'tender value',
      'tender amount',
      'contract value',
      'approximate cost',
      'cost of work',
      'project cost',
      'value of work',
    ],
    targetField: 'Tender Value',
    priority: 3,
  },
  {
    sourceLabels: ['name of work', 'work name', 'scope of work', 'description of work', 'nature of work'],
    targetField: 'Name of Work',
    priority: 4,
  },
  {
    sourceLabels: ['organization', 'tender authority', 'department', 'inviting authority', 'name of organization'],
    targetField: 'Organization',
    priority: 5,
  },
];

export function normalizeLabelForMapping(label: string): string {
  return label
    .toLowerCase()
    .replace(/[:–\-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MappedLabelValueField {
  targetField: FieldLocatorFieldName;
  value: string;
  sourceLabel: string;
  page: number;
  confidence: number;
  sourceText?: string;
  mappingRule: string;
}

function ruleForLabel(normalizedLabel: string): LabelFieldMappingRule | null {
  const sorted = [...LABEL_TO_FIELD_MAPPINGS].sort((a, b) => {
    const maxA = Math.max(...a.sourceLabels.map((l) => l.length));
    const maxB = Math.max(...b.sourceLabels.map((l) => l.length));
    return maxB - maxA;
  });

  for (const rule of sorted) {
    for (const alias of rule.sourceLabels) {
      if (normalizedLabel === alias) return rule;
    }
  }

  for (const rule of sorted) {
    for (const alias of rule.sourceLabels) {
      if (alias.length >= 4 && normalizedLabel.startsWith(alias + ' ')) return rule;
    }
  }

  return null;
}

/**
 * Map extracted label–value pairs to canonical Field Locator fields.
 * One value per target field (best confidence, then earliest page).
 */
export function mapLabelValuePairsToFields(pairs: LabelValuePair[]): MappedLabelValueField[] {
  const byField = new Map<FieldLocatorFieldName, MappedLabelValueField>();

  for (const pair of pairs) {
    const normalized = normalizeLabelForMapping(pair.label);
    const rule = ruleForLabel(normalized);
    if (!rule) continue;

    const mapped: MappedLabelValueField = {
      targetField: rule.targetField,
      value: pair.value.trim(),
      sourceLabel: pair.label,
      page: pair.page,
      confidence: pair.confidence,
      sourceText: pair.sourceText,
      mappingRule: `${pair.label} → ${rule.targetField}`,
    };

    const existing = byField.get(rule.targetField);
    if (!existing) {
      byField.set(rule.targetField, mapped);
      continue;
    }

    if (mapped.confidence > existing.confidence) {
      byField.set(rule.targetField, mapped);
    } else if (mapped.confidence === existing.confidence && mapped.page < existing.page) {
      byField.set(rule.targetField, mapped);
    }
  }

  return Array.from(byField.values()).sort(
    (a, b) => a.targetField.localeCompare(b.targetField)
  );
}

export function getMappingTableForDisplay(): Array<{
  sourceLabel: string;
  targetField: FieldLocatorFieldName;
}> {
  const rows: Array<{ sourceLabel: string; targetField: FieldLocatorFieldName }> = [];
  for (const rule of LABEL_TO_FIELD_MAPPINGS) {
    for (const label of rule.sourceLabels) {
      rows.push({
        sourceLabel: label.replace(/\b\w/g, (c) => c.toUpperCase()),
        targetField: rule.targetField,
      });
    }
  }
  return rows;
}
