import { ValidatedMasterDatasetParameter, ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { ADDITIONAL_TENDER_PARAMETERS_CATEGORY } from '../nit/professionalNitAnalysisSections';
import { resolveDictionaryKey } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import { getDictionaryGroup } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import { classifyProfessionalCategory } from '../tenderParameter/tenderParameterQualityEngine';

export function resolveParameterType(p: ValidatedMasterDatasetParameter): 'core' | 'dynamic' {
  if (p.parameterType === 'dynamic') return 'dynamic';
  if (p.parameterType === 'core') return 'core';
  if (p.category === ADDITIONAL_TENDER_PARAMETERS_CATEGORY) return 'dynamic';
  if (p.canonicalKey && resolveDictionaryKey(p.parameter, p.canonicalKey)) return 'core';
  if (!resolveDictionaryKey(p.parameter, p.canonicalKey)) return 'dynamic';
  return 'core';
}

export function normalizeMasterDatasetParameter(
  p: ValidatedMasterDatasetParameter
): ValidatedMasterDatasetParameter {
  const parameterType = resolveParameterType(p);
  const dictKey = resolveDictionaryKey(p.parameter, p.canonicalKey);

  if (parameterType === 'dynamic') {
    return {
      ...p,
      parameterType: 'dynamic',
      category: ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
      canonicalKey: undefined,
    };
  }

  const group = dictKey ? getDictionaryGroup(dictKey) : undefined;
  return {
    ...p,
    parameterType: 'core',
    canonicalKey: dictKey || p.canonicalKey,
    category: classifyProfessionalCategory(p.parameter, p.value, group),
  };
}

export function normalizeMasterDatasetResult(
  result: ValidatedMasterDatasetResult
): ValidatedMasterDatasetResult {
  const parameters = result.parameters
    .filter((p) => (p.validationStatus === 'validated' || p.validationStatus === 'review') && p.value?.trim())
    .map(normalizeMasterDatasetParameter);

  const categoryCounts: Record<string, number> = {};
  let coreCount = 0;
  let dynamicCount = 0;
  let confidenceSum = 0;

  for (const p of parameters) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    confidenceSum += p.confidence;
    if (p.parameterType === 'dynamic') dynamicCount += 1;
    else coreCount += 1;
  }

  return {
    ...result,
    parameters,
    statistics: {
      totalParameters: parameters.length,
      validatedCount: parameters.length,
      coreCount,
      dynamicCount,
      averageConfidence: parameters.length ? Math.round(confidenceSum / parameters.length) : 0,
      categoryCounts,
    },
  };
}

export function masterDatasetNeedsNormalization(result: ValidatedMasterDatasetResult): boolean {
  if (!result.parameters.length) return false;
  if (result.statistics.coreCount === undefined || result.statistics.dynamicCount === undefined) {
    return true;
  }
  return result.parameters.some((p) => !p.parameterType);
}
