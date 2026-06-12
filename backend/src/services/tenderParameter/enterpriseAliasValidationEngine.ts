import { PageText } from '../../types/intelligence';
import { PageSectionClassification } from '../tenderIntelligence/enterpriseSectionDetectionEngine';
import {
  EnterpriseAliasValidationResult,
  EnterpriseAliasValidationRow,
  EnterpriseAliasValidationStats,
} from '../../types/enterpriseAliasValidation';
import { EnterpriseValidationStatus } from '../../types/enterpriseTenderValidation';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { normalizeCandidatesWithAliasDictionary } from './enterpriseAliasDictionaryEngine';
import { rankEnterpriseTenderParameterCandidates } from './enterpriseTenderCandidateRankingEngine';
import { validateEnterpriseTenderCandidates } from './enterpriseTenderValidationEngine';
import { partitionCoreAndDynamicCandidates } from './tenderParameterCandidatePartition';
import { getMasterAliasRegistrySummary } from './enterpriseTenderAliasEngine';
import { isGenuineTenderParameterRow } from './tenderParameterQualityEngine';
import { normalizeAliasKey } from './tenderParameterAliasEngine';

export const ENTERPRISE_ALIAS_VALIDATION_EXAMPLES = [
  { from: ['EMD', 'Earnest Money Deposit', 'Bid Security'], to: 'EMD Amount' },
  { from: ['Estimated Cost', 'Project Cost', 'Contract Value'], to: 'Tender Value' },
] as const;

function toValidationRow(row: TenderParameterCandidateRow & {
  validationStatus?: EnterpriseValidationStatus;
  validationReason?: string;
  validationRule?: string;
  validationConfidence?: number;
  isDynamicParameter?: boolean;
}): EnterpriseAliasValidationRow {
  return {
    originalLabel: row.originalLabel || row.parameter,
    parameter: row.parameter,
    normalizedParameter: row.normalizedParameter || row.parameter,
    value: row.value,
    page: row.page,
    sourceText: row.sourceText,
    confidence: row.confidence,
    category: row.category,
    canonicalKey: row.canonicalKey,
    aliasMapped: !!row.aliasMapped,
    aliasMatchMethod: row.aliasMatchMethod || '',
    aliasMatchScore: row.aliasMatchScore ?? 0,
    isCoreParameter: !!row.isCoreParameter,
    isDynamicParameter: !!row.isDynamicParameter,
    validationStatus: row.validationStatus || 'REVIEW',
    validationReason: row.validationReason || '',
    validationRule: row.validationRule,
    validationConfidence: row.validationConfidence ?? row.confidence,
  };
}

function buildStats(
  aliasNormalized: TenderParameterCandidateRow[],
  validated: Array<TenderParameterCandidateRow & { validationStatus?: EnterpriseValidationStatus; isDynamicParameter?: boolean }>,
  rejected: Array<TenderParameterCandidateRow & { validationStatus?: EnterpriseValidationStatus }>,
  aliasStats: { aliasMatchedCount: number; exactAliasCount: number; semanticMatchCount: number; unmappedCount: number }
): EnterpriseAliasValidationStats {
  const preserved = validated.filter(
    (r) => r.validationStatus === 'VALID' || r.validationStatus === 'VALID_DYNAMIC_PARAMETER' || r.validationStatus === 'REVIEW'
  );

  return {
    inputCount: aliasNormalized.length,
    aliasMappedCount: aliasStats.aliasMatchedCount,
    exactAliasCount: aliasStats.exactAliasCount,
    semanticMatchCount: aliasStats.semanticMatchCount,
    unmappedCount: aliasStats.unmappedCount,
    validCount: validated.filter((r) => r.validationStatus === 'VALID').length,
    dynamicCount: validated.filter((r) => r.validationStatus === 'VALID_DYNAMIC_PARAMETER').length,
    reviewCount: validated.filter((r) => r.validationStatus === 'REVIEW').length,
    rejectedCount: rejected.length,
    preservedCount: preserved.length,
  };
}

/**
 * Enterprise Alias & Validation Engine.
 * 1. Normalize tender terminology via master alias registry.
 * 2. Validate with preservation rules — reject only OCR garbage.
 * 3. Store unknown genuine parameters as VALID_DYNAMIC_PARAMETER.
 */
export function processEnterpriseAliasAndValidation(
  rawCandidates: Array<{
    parameter: string;
    value: string;
    page: number;
    confidence: number;
    sourceText: string;
    category?: string;
    isCoreParameter?: boolean;
  }>,
  opts?: {
    serviceCategory?: TenderServiceCategory | '';
    pageTexts?: PageText[];
    pageClassifications?: PageSectionClassification[];
    skipRanking?: boolean;
    tenderType?: string;
  }
): {
  aliasNormalized: TenderParameterCandidateRow[];
  validated: EnterpriseAliasValidationRow[];
  rejected: EnterpriseAliasValidationRow[];
  stats: EnterpriseAliasValidationStats;
  aliasExamples: EnterpriseAliasValidationResult['aliasExamples'];
  rankingStats: {
    inputCount: number;
    winnerCount: number;
    rejectedByContext: number;
    duplicateGroups: number;
  };
} {
  const {
    candidates: aliasNormalized,
    aliasStats,
    duplicateMerge,
  } = normalizeCandidatesWithAliasDictionary(rawCandidates, {
    serviceCategory: opts?.serviceCategory,
  });

  const aliasExamples = aliasNormalized
    .filter((r) => r.aliasMapped)
    .slice(0, 20)
    .map((r) => ({
      originalLabel: r.originalLabel,
      normalizedParameter: r.parameter,
      aliasMatchMethod: r.aliasMatchMethod || 'none',
    }));

  let winners = aliasNormalized;
  let rankingStats = {
    inputCount: aliasNormalized.length,
    winnerCount: aliasNormalized.length,
    rejectedByContext: 0,
    duplicateGroups: duplicateMerge.mergedGroups,
  };

  if (!opts?.skipRanking && opts?.pageTexts?.length) {
    const { core, dynamic } = partitionCoreAndDynamicCandidates(aliasNormalized);
    const rankedCore = rankEnterpriseTenderParameterCandidates(
      core,
      opts.pageTexts,
      opts.pageClassifications || [],
      { tenderType: opts.tenderType }
    );
    const rankedDynamic = rankEnterpriseTenderParameterCandidates(
      dynamic,
      opts.pageTexts,
      opts.pageClassifications || [],
      { tenderType: opts.tenderType }
    );
    winners = [...rankedCore.winners, ...rankedDynamic.winners];

    const winnerKeys = new Set(
      winners.map((w) => `${normalizeAliasKey(w.parameter)}|${normalizeAliasKey(w.value)}`)
    );
    for (const rejected of [...rankedCore.rejected, ...rankedDynamic.rejected]) {
      if (!isGenuineTenderParameterRow(rejected)) continue;
      const key = `${normalizeAliasKey(rejected.parameter)}|${normalizeAliasKey(rejected.value)}`;
      if (winnerKeys.has(key)) continue;
      winners.push({
        ...rejected,
        rankWinner: true,
        rankReason: rejected.rankReason || 'Preserved — genuine parameter from annexure/spec context',
      });
      winnerKeys.add(key);
    }

    if (!winners.length && aliasNormalized.length) {
      winners = aliasNormalized;
    }
    rankingStats = {
      inputCount: rankedCore.stats.inputCount + rankedDynamic.stats.inputCount,
      winnerCount: rankedCore.stats.winnerCount + rankedDynamic.stats.winnerCount,
      rejectedByContext:
        rankedCore.stats.rejectedByContext +
        rankedDynamic.stats.rejectedByContext +
        rankedCore.stats.rejectedBySpecialRule +
        rankedDynamic.stats.rejectedBySpecialRule,
      duplicateGroups:
        duplicateMerge.mergedGroups +
        rankedCore.stats.duplicateGroups +
        rankedDynamic.stats.duplicateGroups,
    };
  }

  const batch = validateEnterpriseTenderCandidates(winners, {
    allCandidates: aliasNormalized,
    tenderType: opts?.tenderType,
  });

  const validated = batch.storable.map((r) => toValidationRow(r));
  const rejected = batch.rejected.map((r) => toValidationRow(r));

  const stats = buildStats(aliasNormalized, batch.storable, batch.rejected, aliasStats);

  return {
    aliasNormalized,
    validated,
    rejected,
    stats,
    aliasExamples,
    rankingStats,
  };
}

export function getEnterpriseAliasValidationRegistry() {
  const aliasRegistry = getMasterAliasRegistrySummary();
  return {
    aliasExamples: ENTERPRISE_ALIAS_VALIDATION_EXAMPLES,
    validationStatuses: ['VALID', 'VALID_DYNAMIC_PARAMETER', 'REVIEW', 'REJECT'] as EnterpriseValidationStatus[],
    preservationPolicy: 'Enterprise validation: store VALID and REVIEW in Master Dataset. Reject REJECT.',
    aliasRegistry,
  };
}
