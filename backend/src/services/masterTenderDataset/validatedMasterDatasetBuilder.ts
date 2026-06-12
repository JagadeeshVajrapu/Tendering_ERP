import { MasterDatasetKey, MasterDatasetField, MasterTenderDataset } from '../../types/masterDataset';
import {
  ValidatedMasterDatasetParameter,
  ValidatedMasterDatasetResult,
  ValidatedMasterDatasetStatistics,
} from '../../types/validatedMasterDataset';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import {
  getDictionaryGroup,
  resolveDictionaryKey,
  normalizeParamName,
} from '../tenderParameter/masterTenderParameterDictionaryEngine';
import { classifyProfessionalCategory } from '../tenderParameter/tenderParameterQualityEngine';
import { getDictionaryCanonicalLabel } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import { MASTER_DATASET_KEYS } from '../../types/masterDataset';
import { ADDITIONAL_TENDER_PARAMETERS_CATEGORY } from '../nit/professionalNitAnalysisSections';
import { normalizeAliasKey } from '../tenderParameter/tenderParameterAliasEngine';
import { isAllowedMasterParameter } from '../tenderParameter/masterTenderParameterDictionaryEngine';

function emptyLegacyDataset(): MasterTenderDataset {
  const dataset = {} as MasterTenderDataset;
  for (const key of MASTER_DATASET_KEYS) {
    dataset[key] = { value: '', confidence: 0, sourcePage: 0, sourceText: '' };
  }
  return dataset;
}

function computeStatistics(parameters: ValidatedMasterDatasetParameter[]): ValidatedMasterDatasetStatistics {
  const categoryCounts: Record<string, number> = {};
  let confidenceSum = 0;
  let coreCount = 0;
  let dynamicCount = 0;

  for (const p of parameters) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    confidenceSum += p.confidence;
    if (p.parameterType === 'dynamic') dynamicCount += 1;
    else coreCount += 1;
  }

  return {
    totalParameters: parameters.length,
    validatedCount: parameters.filter((p) => p.validationStatus === 'validated').length,
    coreCount,
    dynamicCount,
    averageConfidence: parameters.length ? Math.round(confidenceSum / parameters.length) : 0,
    categoryCounts,
  };
}

function mapValidationStatus(row: TenderParameterCandidateRow): ValidatedMasterDatasetParameter['validationStatus'] {
  if (row.validationStatus === 'REVIEW') return 'review';
  if (row.validationStatus === 'REJECT') return 'rejected';
  if (row.validationStatus === 'VALID_DYNAMIC_PARAMETER') return 'validated';
  return 'validated';
}

function buildCoreParameter(row: TenderParameterCandidateRow): ValidatedMasterDatasetParameter | null {
  const dictKey = resolveDictionaryKey(row.parameter, row.canonicalKey);
  if (!dictKey) return null;

  const dictionaryGroup = getDictionaryGroup(dictKey);
  const category = classifyProfessionalCategory(row.parameter, row.value, dictionaryGroup);

  return {
    parameter: getDictionaryCanonicalLabel(dictKey),
    value: row.value,
    page: row.page,
    confidence: row.validationConfidence ?? row.confidence,
    sourceText: row.sourceText,
    validationStatus: mapValidationStatus(row),
    parameterType: 'core',
    category,
    canonicalKey: dictKey,
    originalLabel: row.originalLabel || row.parameter,
  };
}

function buildDynamicParameter(row: TenderParameterCandidateRow): ValidatedMasterDatasetParameter | null {
  if (isAllowedMasterParameter(row.parameter, row.canonicalKey)) return null;

  const label = (row.originalLabel || row.parameter || '').trim();
  if (!label) return null;

  const category =
    row.category && row.category !== ADDITIONAL_TENDER_PARAMETERS_CATEGORY
      ? row.category
      : ADDITIONAL_TENDER_PARAMETERS_CATEGORY;

  return {
    parameter: label,
    value: row.value,
    page: row.page,
    confidence: row.validationConfidence ?? row.confidence,
    sourceText: row.sourceText,
    validationStatus: mapValidationStatus(row),
    parameterType: 'dynamic',
    category,
    originalLabel: row.originalLabel || row.parameter,
  };
}

export function buildValidatedMasterDatasetParameters(
  candidates: TenderParameterCandidateRow[]
): ValidatedMasterDatasetParameter[] {
  const coreSeen = new Set<string>();
  const dynamicSeen = new Map<string, ValidatedMasterDatasetParameter>();
  const valueSeen = new Set<string>();
  const parameters: ValidatedMasterDatasetParameter[] = [];

  const sorted = [...candidates]
    .filter((row) => {
      if (!row.value?.trim()) return false;
      if (row.validationStatus === 'REJECT' || row.validationPassed === false) return false;
      return (
        row.validationStatus === 'VALID' ||
        row.validationStatus === 'REVIEW' ||
        row.validationStatus === 'VALID_DYNAMIC_PARAMETER'
      );
    })
    .sort((a, b) => b.confidence - a.confidence || a.page - b.page);

  for (const row of sorted) {
    const valueKey = `${normalizeAliasKey(row.parameter)}|${normalizeAliasKey(row.value)}`;
    if (valueSeen.has(valueKey)) continue;

    if (isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
      const core = buildCoreParameter(row);
      if (!core?.canonicalKey || coreSeen.has(core.canonicalKey)) continue;
      coreSeen.add(core.canonicalKey);
      valueSeen.add(valueKey);
      parameters.push(core);
      continue;
    }

    const dynamic = buildDynamicParameter(row);
    if (!dynamic) continue;

    const dynamicKey = `${normalizeParamName(dynamic.parameter)}|${normalizeAliasKey(dynamic.value)}`;
    if (dynamicSeen.has(dynamicKey)) continue;

    dynamicSeen.set(dynamicKey, dynamic);
    valueSeen.add(valueKey);
  }

  for (const dynamic of dynamicSeen.values()) {
    parameters.push(dynamic);
  }

  return parameters.sort((a, b) => a.page - b.page || a.parameter.localeCompare(b.parameter));
}

export function buildValidatedMasterDatasetResult(
  documentId: string,
  tenderId: string,
  candidates: TenderParameterCandidateRow[]
): ValidatedMasterDatasetResult {
  const parameters = buildValidatedMasterDatasetParameters(candidates);
  return {
    documentId,
    tenderId,
    parameters,
    statistics: computeStatistics(parameters),
    builtAt: new Date().toISOString(),
  };
}

/** Convert validated core parameters to legacy keyed dataset for report adapters. */
export function validatedParametersToLegacyDataset(
  parameters: ValidatedMasterDatasetParameter[]
): MasterTenderDataset {
  const dataset = emptyLegacyDataset();

  for (const p of parameters) {
    if (p.parameterType !== 'core' || !p.canonicalKey || !(p.canonicalKey in dataset)) continue;
    const key = p.canonicalKey as MasterDatasetKey;
    const field: MasterDatasetField = {
      value: p.value,
      confidence: p.confidence,
      sourcePage: p.page,
      sourceText: p.sourceText,
      extractionMethod: 'validated_master_dataset',
    };
    if (!dataset[key].value || field.confidence >= dataset[key].confidence) {
      dataset[key] = field;
    }
  }

  return dataset;
}
