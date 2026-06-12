import {

  DiscoveredDynamicParameter,

  EnterpriseDynamicDiscoveryResult,

} from '../../types/enterpriseDynamicParameterDiscovery';

import { EnterpriseValidatedCandidate } from '../../types/enterpriseTenderValidation';

import { TenderServiceCategory } from '../../types/tenderServiceClassification';

import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';

import {

  isGarbageTenderParameterLabel,

  isGenuineTenderParameterRow,

} from './tenderParameterQualityEngine';

import { classifyDiscoveredParameter } from './dynamicParameterClassificationEngine';

import { evaluateDynamicParametersWithAi } from './dynamicParameterAiEvaluator';

import {

  getPromotedParameters,

  recordDiscoveredParameter,

} from './dynamicParameterLearningRegistry';

import { ADDITIONAL_TENDER_PARAMETERS_CATEGORY } from '../nit/professionalNitAnalysisSections';

import {

  filterDuplicateDynamicParameters,

  isAllowedBusinessCategory,

  normalizeBusinessCategory,

  rejectBusinessIrrelevantDynamicParameter,

  resolveKnownAdditionalParameter,

} from './businessRelevantDynamicParameterEngine';

import {

  filterEnterpriseDynamicParameter,

  DYNAMIC_PARAMETER_FILTER_THRESHOLD,

} from './enterpriseDynamicParameterFilteringEngine';



function ruleRejectDynamic(row: EnterpriseValidatedCandidate): string | null {

  const label = (row.originalLabel || row.parameter || '').trim();

  if (!label) return 'empty_label';

  if (!isGenuineTenderParameterRow(row)) return 'not_genuine_parameter';

  if (isGarbageTenderParameterLabel(label)) return 'ocr_garbage';



  const businessReject = rejectBusinessIrrelevantDynamicParameter({

    parameter: label,

    value: row.value,

    sourceText: row.sourceText,

    page: row.page,

  });

  if (businessReject) return businessReject;



  if (!row.value?.trim() || row.value.trim().length < 2) return 'empty_value';

  return null;

}



function toDiscovered(

  row: EnterpriseValidatedCandidate,

  opts: {

    validationStatus: DiscoveredDynamicParameter['validationStatus'];

    category: string;

    discoveryMethod: DiscoveredDynamicParameter['discoveryMethod'];

    aiEvaluated?: boolean;

    aiReason?: string;

    confidence?: number;

  }

): DiscoveredDynamicParameter {

  return {

    ...row,

    parameter: row.parameter,

    originalLabel: row.originalLabel || row.parameter,

    value: row.value,

    page: row.page,

    confidence: opts.confidence ?? row.validationConfidence ?? row.confidence,

    category: opts.category,

    isCoreParameter: false,

    validationStatus: opts.validationStatus,

    sourceText: row.sourceText,

    validationPassed: opts.validationStatus !== 'REJECT',

    aiEvaluated: opts.aiEvaluated,

    aiReason: opts.aiReason,

    discoveryMethod: opts.discoveryMethod,

  };

}



export async function discoverEnterpriseDynamicParameters(

  validatedCandidates: EnterpriseValidatedCandidate[],

  opts: {

    documentId: string;

    tenderId: string;

    serviceCategory?: TenderServiceCategory | '';

    tenderType?: string;

  }

): Promise<EnterpriseDynamicDiscoveryResult> {

  const serviceCategory = opts.serviceCategory || '';

  const coreParameters = validatedCandidates.filter((r) =>

    isAllowedMasterParameter(r.parameter, r.canonicalKey)

  );

  const dynamicInput = validatedCandidates.filter(

    (r) => !isAllowedMasterParameter(r.parameter, r.canonicalKey)

  );



  const discovered: DiscoveredDynamicParameter[] = [];

  const rejected: DiscoveredDynamicParameter[] = [];

  const candidatesForAi: EnterpriseValidatedCandidate[] = [];

  let registryMatchCount = 0;



  for (const row of dynamicInput) {

    const ruleReason = ruleRejectDynamic(row);

    if (ruleReason) {

      rejected.push(

        toDiscovered(row, {

          validationStatus: 'REJECT',

          category: ADDITIONAL_TENDER_PARAMETERS_CATEGORY,

          discoveryMethod: 'rules',

          aiReason: ruleReason,

        })

      );

      continue;

    }

    const label = (row.originalLabel || row.parameter || '').trim();

    const registryEntry = resolveKnownAdditionalParameter(label);

    if (registryEntry) {

      registryMatchCount += 1;

      const registryFilter = filterEnterpriseDynamicParameter({

        parameter: row.parameter,

        originalLabel: row.originalLabel,

        value: row.value,

        sourceText: row.sourceText,

        page: row.page,

        validationStatus: row.validationStatus || 'VALID_DYNAMIC_PARAMETER',

        validationPassed: row.validationPassed ?? true,

        tenderType: opts.tenderType,

        skipAiRequirement: true,

      });

      if (!registryFilter.stored) {

        rejected.push(

          toDiscovered(row, {

            validationStatus: 'REJECT',

            category: ADDITIONAL_TENDER_PARAMETERS_CATEGORY,

            discoveryMethod: 'registry',

            aiReason: registryFilter.rejectionReason || 'Registry match failed filter threshold',

          })

        );

        continue;

      }

      discovered.push(

        toDiscovered(row, {

          validationStatus: 'VALID_DYNAMIC_PARAMETER',

          category: registryEntry.category || ADDITIONAL_TENDER_PARAMETERS_CATEGORY,

          discoveryMethod: 'registry',

          aiReason: `Matched registry — filter score ${registryFilter.filterScore}`,

          confidence: Math.max(row.validationConfidence ?? 0, row.confidence ?? 0, registryFilter.filterScore),

        })

      );

      continue;

    }

    candidatesForAi.push(row);

  }



  const { unique: uniqueForAi, duplicates } = filterDuplicateDynamicParameters(candidatesForAi);

  for (const dup of duplicates) {

    rejected.push(

      toDiscovered(dup, {

        validationStatus: 'REJECT',

        category: ADDITIONAL_TENDER_PARAMETERS_CATEGORY,

        discoveryMethod: 'rules',

        aiReason: 'repeated_text',

      })

    );

  }



  const AI_BATCH = 12;

  let aiEvaluatedCount = 0;



  for (let i = 0; i < uniqueForAi.length; i += AI_BATCH) {

    const batch = uniqueForAi.slice(i, i + AI_BATCH);

    const evaluations = await evaluateDynamicParametersWithAi(

      batch.map((r) => ({

        parameter: r.parameter,

        value: r.value,

        sourceText: r.sourceText,

        page: r.page,

      }))

    );

    aiEvaluatedCount += batch.length;



    for (let j = 0; j < batch.length; j++) {

      const row = batch[j];

      const evalResult = evaluations[j];



      if (!evalResult?.genuine) {

        rejected.push(

          toDiscovered(row, {

            validationStatus: 'REJECT',

            category: evalResult?.category || ADDITIONAL_TENDER_PARAMETERS_CATEGORY,

            discoveryMethod: 'ai',

            aiEvaluated: true,

            aiReason: evalResult?.reason || 'AI rejected — not a genuine tender requirement',

          })

        );

        continue;

      }



      const category = normalizeBusinessCategory(

        evalResult.category || classifyDiscoveredParameter(row.parameter, row.value)

      );

      const filterResult = filterEnterpriseDynamicParameter({

        parameter: row.parameter,

        originalLabel: row.originalLabel,

        value: row.value,

        sourceText: row.sourceText,

        page: row.page,

        validationStatus: row.validationStatus,

        validationPassed: row.validationPassed ?? undefined,

        tenderType: opts.tenderType,

        aiGenuine: evalResult.genuine,

        aiCategory: category,

      });

      if (!filterResult.stored) {

        rejected.push(

          toDiscovered(row, {

            validationStatus: 'REJECT',

            category,

            discoveryMethod: 'ai',

            aiEvaluated: true,

            aiReason:

              filterResult.rejectionReason ||

              `Filter score ${filterResult.filterScore} below threshold ${DYNAMIC_PARAMETER_FILTER_THRESHOLD}`,

          })

        );

        continue;

      }

      if (!isAllowedBusinessCategory(category)) {

        rejected.push(

          toDiscovered(row, {

            validationStatus: 'REJECT',

            category,

            discoveryMethod: 'ai',

            aiEvaluated: true,

            aiReason: `Category "${category}" is not business-relevant`,

          })

        );

        continue;

      }

      const status: DiscoveredDynamicParameter['validationStatus'] =

        filterResult.status === 'REVIEW' || evalResult.confidence < 70

          ? 'REVIEW'

          : 'VALID_DYNAMIC_PARAMETER';



      discovered.push(

        toDiscovered(row, {

          validationStatus: status,

          category,

          discoveryMethod: 'ai',

          aiEvaluated: true,

          aiReason: evalResult.reason,

          confidence: evalResult.confidence,

        })

      );

    }

  }



  const promoted = await getPromotedParameters();



  for (const param of discovered.filter((d) => d.validationStatus !== 'REJECT')) {

    await recordDiscoveredParameter({

      parameter: param.parameter,

      originalLabel: param.originalLabel,

      value: param.value,

      category: String(param.category),

      serviceCategory,

    });

  }



  console.log('[BusinessRelevantDiscovery] Complete', {

    documentId: opts.documentId,

    inputDynamic: dynamicInput.length,

    ruleRejected: rejected.filter((r) => r.discoveryMethod === 'rules').length,

    aiEvaluated: aiEvaluatedCount,

    discovered: discovered.length,

    rejected: rejected.length,

  });



  return {

    documentId: opts.documentId,

    tenderId: opts.tenderId,

    serviceCategory,

    coreParameters,

    discovered: discovered.filter((d) => d.validationStatus !== 'REJECT'),

    rejected,

    promoted,

    stats: {

      inputDynamicCount: dynamicInput.length,

      discoveredCount: discovered.filter((d) => d.validationStatus !== 'REJECT').length,

      rejectedCount: rejected.length,

      aiEvaluatedCount,

      registryMatchCount,

      learningMatchCount: 0,

    },

    discoveredAt: new Date().toISOString(),

  };

}


