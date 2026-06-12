import { CanonicalPipelineResult } from './canonicalTenderPipeline';
import { validatedParametersToLegacyDataset } from '../masterTenderDataset/validatedMasterDatasetBuilder';
import { FeasibilityRecommendation } from '../../types/intelligence';
import { ITenderAnalysisData } from '../../models/TenderAnalysis';
import { MasterDatasetKey, MasterTenderDataset } from '../../types/masterDataset';

function pickParam(master: CanonicalPipelineResult['masterDataset'], ...names: string[]): string {
  const lower = names.map((n) => n.toLowerCase());
  const hit = master.parameters.find((p) =>
    lower.some(
      (n) =>
        p.parameter.toLowerCase().includes(n) ||
        (p.canonicalKey || '').toLowerCase().includes(n)
    )
  );
  return hit?.value?.trim() || '';
}

export function buildIntelligencePayloadFromCanonical(
  result: CanonicalPipelineResult,
  extras: {
    processingTimeMs: number;
  }
) {
  const dataset = validatedParametersToLegacyDataset(result.masterDataset.parameters);
  const scope = pickParam(result.masterDataset, 'scope', 'work description', 'tender title');
  const eligibility = pickParam(result.masterDataset, 'eligibility', 'qualification');
  const emd = pickParam(result.masterDataset, 'emd', 'earnest money');
  const tenderValue = pickParam(result.masterDataset, 'estimated', 'tender value', 'contract value');
  const submission = pickParam(result.masterDataset, 'bid submission', 'last date', 'closing date');

  const riskSection = result.nitAnalysis.sections.find((s) => s.id === 'risk');
  const riskSummary =
    riskSection?.fields.map((f) => `${f.label}: ${f.value}`).join('; ') ||
    'Risk assessment from validated master dataset.';

  const recommendation: FeasibilityRecommendation =
    result.masterDataset.statistics.validatedCount >= 4 ? 'Apply' : 'Apply with Caution';

  return {
    phase: 'complete' as const,
    pipelineSteps: result.steps,
    scopeSummary: scope || 'See NIT Analysis table for extracted scope fields.',
    eligibilitySummary: eligibility || 'See NIT Analysis for eligibility criteria.',
    timelineSummary: submission || 'See NIT Analysis for key dates.',
    financialSummary: [tenderValue, emd].filter(Boolean).join(' · ') || 'See NIT Analysis for financial fields.',
    riskSummary,
    recommendation,
    nitAnalysisReport: result.nitAnalysis,
    masterDatasetStatistics: result.masterDataset.statistics,
    validatedParameterCount: result.masterDataset.statistics.validatedCount,
    requirementCount: result.requirements.totalItems,
    checklistReadiness: result.checklist.summary.readinessScore,
    aiModel: 'canonical-tender-pipeline',
    processingTimeMs: extras.processingTimeMs,
    merged: {} as Record<string, never>,
    productionFields: result.masterDataset.parameters.map((p) => ({
      fieldName: p.parameter,
      value: p.value,
      sourcePage: p.page,
      sourceText: p.sourceText,
      confidence: p.confidence,
      extractionMethod: 'validated_master_dataset',
    })),
    dataset,
  };
}

export function buildLegacyAnalysisFromMasterDataset(
  master: CanonicalPipelineResult['masterDataset']
): ITenderAnalysisData {
  const dataset: MasterTenderDataset = validatedParametersToLegacyDataset(master.parameters);
  const g = (key: MasterDatasetKey) => dataset[key]?.value?.trim() || '';

  return {
    tenderName: g('tenderTitle') || g('workName') || g('scopeOfWork'),
    department: g('department'),
    organization: g('organization'),
    tenderNumber: g('tenderNumber') || g('nitNumber') || g('bidReferenceNumber'),
    estimatedValue: g('estimatedCost') || g('tenderValue'),
    emdAmount: g('emdAmount'),
    bgRequirement: g('bankGuarantee') || g('performanceSecurity'),
    bidSubmissionDate: g('bidEndDate') || g('bidStartDate'),
    preBidMeetingDate: g('preBidMeetingDate'),
    contractDuration: g('completionPeriod') || g('contractPeriod'),
    scopeOfWork: g('scopeOfWork') || g('workName'),
    eligibilityCriteria: g('eligibilityCriteria') ? [g('eligibilityCriteria')] : [],
    technicalRequirements: g('technicalRequirements') ? [g('technicalRequirements')] : [],
    reverseAuction: '',
    mafRequired: '',
    requiredDocuments: [],
    importantDates: [],
    paymentTerms: g('paymentTerms'),
    riskFactors: [],
    aiRecommendation: 'Canonical pipeline — validated master dataset',
  };
}
