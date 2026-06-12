import { NitAnalysisReport } from '../../types/nitAnalysisReport';
import { ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { EnterpriseMasterDatasetResult } from '../../types/enterpriseMasterDataset';
import { buildEnterpriseDynamicNitAnalysis } from './enterpriseDynamicNitAnalysisEngine';

function toEnterpriseResult(master: ValidatedMasterDatasetResult): EnterpriseMasterDatasetResult {
  return {
    documentId: master.documentId,
    tenderId: master.tenderId,
    serviceCategory: 'unclassified',
    schemaVersion: 3,
    currentVersion: 1,
    parameters: master.parameters.map((p) => ({
      documentId: master.documentId,
      tenderId: master.tenderId,
      parameter: p.parameter,
      normalizedParameter: p.originalLabel || p.parameter,
      value: p.value,
      category: p.category,
      serviceCategory: 'unclassified',
      pageNumber: p.page,
      confidence: p.confidence,
      validationStatus:
        p.validationStatus === 'review'
          ? 'REVIEW'
          : p.parameterType === 'dynamic'
            ? 'VALID_DYNAMIC_PARAMETER'
            : 'VALID',
      isCoreParameter: p.parameterType !== 'dynamic',
      sourceText: p.sourceText,
      sourceSection: p.category,
      rankingScore: 0,
      validationReason: '',
      rankingReason: '',
      canonicalKey: p.canonicalKey,
      parameterType: p.parameterType,
      duplicateHistory: [],
      schemaVersion: 3,
    })),
    rejected: [],
    statistics: {
      totalParameters: master.statistics.totalParameters,
      coreCount: master.statistics.coreCount,
      dynamicCount: master.statistics.dynamicCount,
      reviewCount: master.parameters.filter((p) => p.validationStatus === 'review').length,
      verifiedCount: master.statistics.validatedCount,
      verificationRejectedCount: 0,
      validatedCount: master.statistics.validatedCount,
      rejectedCount: 0,
      averageConfidence: master.statistics.averageConfidence,
      categoryCounts: master.statistics.categoryCounts,
    },
    versions: [],
    builtAt: master.builtAt,
    dataSource: 'enterprise_master_dataset',
  };
}

/**
 * Dynamic Professional NIT Analysis — reads ONLY from validated master dataset.
 * Delegates to enterprise dynamic engine.
 */
export function buildProfessionalNitAnalysis(
  tenderId: string,
  documentId: string,
  originalName: string | undefined,
  master: ValidatedMasterDatasetResult,
  steps: string[]
): NitAnalysisReport {
  return buildEnterpriseDynamicNitAnalysis(
    tenderId,
    documentId,
    originalName,
    toEnterpriseResult(master),
    steps
  );
}

export function buildProfessionalNitAnalysisFromEnterprise(
  tenderId: string,
  documentId: string,
  originalName: string | undefined,
  master: EnterpriseMasterDatasetResult,
  steps: string[]
): NitAnalysisReport {
  return buildEnterpriseDynamicNitAnalysis(tenderId, documentId, originalName, master, steps);
}

/** @deprecated Use buildProfessionalNitAnalysis */
export const buildNitAnalysisFromValidatedMasterDataset = buildProfessionalNitAnalysis;
