import {
  MasterDatasetField,
  MasterDatasetKey,
  MASTER_DATASET_KEYS,
} from '../../types/masterDataset';
import { SourceFieldRecord } from './masterDatasetBuilder';
import { MASTER_FIELD_SOURCE_ALIASES } from './masterDatasetFieldRegistry';
import { LOCATOR_TO_MASTER_KEY, DatasetSelectionReason } from './masterDatasetLocatorMap';
import { validateMasterFieldValue } from './masterDatasetFieldValidation';

export interface PriorityMergeInput {
  fieldLocatorFields: SourceFieldRecord[];
  validatedFields: Array<SourceFieldRecord & { valid: boolean }>;
  extractedFields: SourceFieldRecord[];
  aiVerifiedFields: SourceFieldRecord[];
}

export interface FieldSelectionTrace {
  masterKey: MasterDatasetKey;
  fieldLocatorValue: string | null;
  validatedRuleValue: string | null;
  openAiValue: string | null;
  ruleExtractionValue: string | null;
  finalValue: string;
  reasonSelected: DatasetSelectionReason;
  rejectionNotes: string[];
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function emptyField(): MasterDatasetField {
  return { value: '', confidence: 0, sourcePage: 0, sourceText: '', extractionMethod: '' };
}

function toMasterField(
  record: SourceFieldRecord,
  extractionMethod: string
): MasterDatasetField {
  return {
    value: record.value.trim(),
    confidence: record.confidence,
    sourcePage: record.sourcePage,
    sourceText: record.sourceText,
    extractionMethod,
  };
}

function indexByMasterKey(
  records: SourceFieldRecord[],
  aliasMap: Record<MasterDatasetKey, string[]>
): Map<MasterDatasetKey, SourceFieldRecord> {
  const byLabel = new Map<string, SourceFieldRecord>();
  for (const r of records) {
    if (!r.value?.trim()) continue;
    const key = normalizeLabel(r.fieldName);
    const existing = byLabel.get(key);
    if (!existing || r.confidence > existing.confidence) {
      byLabel.set(key, r);
    }
  }

  const out = new Map<MasterDatasetKey, SourceFieldRecord>();
  for (const masterKey of MASTER_DATASET_KEYS) {
    const aliases = aliasMap[masterKey] || [];
    for (const alias of aliases) {
      const hit = byLabel.get(normalizeLabel(alias));
      if (hit) {
        out.set(masterKey, hit);
        break;
      }
    }
  }
  return out;
}

function indexLocatorByMasterKey(
  records: SourceFieldRecord[]
): Map<MasterDatasetKey, SourceFieldRecord> {
  const fromAliases = indexByMasterKey(records, MASTER_FIELD_SOURCE_ALIASES);
  const out = new Map<MasterDatasetKey, SourceFieldRecord>(fromAliases);

  for (const r of records) {
    const masterKey = LOCATOR_TO_MASTER_KEY[r.fieldName];
    if (!masterKey || !r.value?.trim()) continue;
    if (!out.has(masterKey)) {
      out.set(masterKey, r);
    }
  }

  return out;
}

function pickForKey(
  key: MasterDatasetKey,
  locator: SourceFieldRecord | undefined,
  validated: SourceFieldRecord | undefined,
  extracted: SourceFieldRecord | undefined,
  openAi: SourceFieldRecord | undefined
): { field: MasterDatasetField; reason: DatasetSelectionReason; trace: FieldSelectionTrace } {
  const rejectionNotes: string[] = [];

  const tryPick = (
    record: SourceFieldRecord | undefined,
    reason: DatasetSelectionReason,
    method: string
  ): MasterDatasetField | null => {
    if (!record?.value?.trim()) return null;
    const check = validateMasterFieldValue(key, record.value);
    if (!check.valid) {
      rejectionNotes.push(`${reason}: ${check.reason}`);
      return null;
    }
    return toMasterField(record, method);
  };

  const trace: FieldSelectionTrace = {
    masterKey: key,
    fieldLocatorValue: locator?.value?.trim() || null,
    validatedRuleValue: validated?.value?.trim() || null,
    openAiValue: openAi?.value?.trim() || null,
    ruleExtractionValue: extracted?.value?.trim() || null,
    finalValue: '',
    reasonSelected: 'none',
    rejectionNotes,
  };

  const locatorField = tryPick(
    locator,
    'field_locator',
    locator?.extractionMethod || 'field_locator'
  );
  if (locatorField) {
    trace.finalValue = locatorField.value;
    trace.reasonSelected = 'field_locator';
    return { field: locatorField, reason: 'field_locator', trace };
  }

  const validatedField = tryPick(
    validated,
    'validated_rule',
    'validated_rule'
  );
  if (validatedField) {
    trace.finalValue = validatedField.value;
    trace.reasonSelected = 'validated_rule';
    return { field: validatedField, reason: 'validated_rule', trace };
  }

  const ruleField = tryPick(extracted, 'rule_extraction', 'rule_extraction');
  if (ruleField) {
    trace.finalValue = ruleField.value;
    trace.reasonSelected = 'rule_extraction';
    return { field: ruleField, reason: 'rule_extraction', trace };
  }

  const openAiField = tryPick(openAi, 'openai_verification', 'openai_verification');
  if (openAiField) {
    trace.finalValue = openAiField.value;
    trace.reasonSelected = 'openai_verification';
    return { field: openAiField, reason: 'openai_verification', trace };
  }

  trace.reasonSelected = 'none';
  return { field: emptyField(), reason: 'none', trace };
}

export function mergeWithPriority(input: PriorityMergeInput): {
  dataset: Record<MasterDatasetKey, MasterDatasetField>;
  traces: FieldSelectionTrace[];
} {
  const locatorByKey = indexLocatorByMasterKey(input.fieldLocatorFields);
  const validatedByKey = indexByMasterKey(
    input.validatedFields.filter((v) => v.valid).map(({ valid: _v, ...rest }) => rest),
    MASTER_FIELD_SOURCE_ALIASES
  );
  const extractedByKey = indexByMasterKey(input.extractedFields, MASTER_FIELD_SOURCE_ALIASES);
  const openAiByKey = indexByMasterKey(input.aiVerifiedFields, MASTER_FIELD_SOURCE_ALIASES);

  const dataset = {} as Record<MasterDatasetKey, MasterDatasetField>;
  const traces: FieldSelectionTrace[] = [];

  for (const key of MASTER_DATASET_KEYS) {
    const { field, trace } = pickForKey(
      key,
      locatorByKey.get(key),
      validatedByKey.get(key),
      extractedByKey.get(key),
      openAiByKey.get(key)
    );
    dataset[key] = field;
    traces.push(trace);
  }

  return { dataset, traces };
}
