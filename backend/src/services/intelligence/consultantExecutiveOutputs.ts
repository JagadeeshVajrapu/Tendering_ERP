import { FeasibilityRecommendation } from '../../types/intelligence';
import { ExtractedProductionField } from './extractedProductionField';
import { VerifiedNitJson } from './verifiedNitJsonBuilder';
import { getVerifiedFieldValue } from './executiveDisplayFormatter';
import { buildExecutiveSummaryFromValidated } from './executiveSummaryBuilder';
import { RiskAnalysisResult } from '../../types/riskAnalysis';

function pick(fields: ExtractedProductionField[], ids: string[]): string | null {
  return getVerifiedFieldValue(fields, ids)?.value ?? null;
}

function linesFromFields(
  fields: ExtractedProductionField[],
  filter: (f: ExtractedProductionField) => boolean
): string {
  return fields
    .filter((f) => f.validated && filter(f))
    .map((f) => {
      const v = Array.isArray(f.value) ? f.value.join('; ') : String(f.value);
      return `${f.label}: ${v}`;
    })
    .join('. ')
    .slice(0, 600);
}

/**
 * Step 8 — Executive summary from verified fields only (no raw AI extraction).
 */
export function buildConsultantExecutiveSummaries(
  productionFields: ExtractedProductionField[],
  verifiedNit: VerifiedNitJson,
  riskAnalysis?: RiskAnalysisResult
): {
  scopeSummary: string;
  eligibilitySummary: string;
  timelineSummary: string;
  financialSummary: string;
  riskSummary: string;
  recommendation: FeasibilityRecommendation;
  executiveBullets: string[];
} {
  const scopeFromJson = verifiedNit.scopeOfWork;
  const scopeFromField = pick(productionFields, ['scopeOfWork']);
  const scopeSummary = (scopeFromJson || scopeFromField || '').slice(0, 400);

  const eligibilityParts = [
    verifiedNit.turnoverRequirement,
    verifiedNit.experienceRequirement,
    verifiedNit.gstRequirement,
    verifiedNit.epfRequirement,
    verifiedNit.esiRequirement,
    verifiedNit.labourLicense,
  ].filter(Boolean);

  const eligibilityFromFields = linesFromFields(
    productionFields,
    (f) => f.section === 'eligibility'
  );

  const eligibilitySummary =
    eligibilityParts.length > 0
      ? eligibilityParts.join('. ')
      : eligibilityFromFields || '';

  const timelineParts = [
    verifiedNit.bidSubmissionDate,
    verifiedNit.bidOpeningDate,
    verifiedNit.preBidMeetingDate,
    verifiedNit.contractDuration,
  ].filter(Boolean);

  const timelineFromFields = linesFromFields(
    productionFields,
    (f) => f.section === 'timeline'
  );

  const timelineSummary =
    timelineParts.length > 0 ? timelineParts.join('. ') : timelineFromFields || '';

  const financialParts = [
    verifiedNit.estimatedTenderValue && `Tender Value: ${verifiedNit.estimatedTenderValue}`,
    verifiedNit.emdAmount && `EMD: ${verifiedNit.emdAmount}`,
    verifiedNit.tenderFee && `Tender Fee: ${verifiedNit.tenderFee}`,
  ].filter(Boolean);

  const financialFromFields = linesFromFields(
    productionFields,
    (f) => f.section === 'financial'
  );

  const financialSummary =
    financialParts.length > 0 ? financialParts.join('. ') : financialFromFields || '';

  const riskSummary = riskAnalysis
    ? riskAnalysis.items
        .map((r) => `${r.category} (${r.level}, ${r.confidence}% confidence): ${r.explanation}`)
        .join(' ')
        .slice(0, 800)
    : (() => {
        const riskF = productionFields.find((f) => f.id === 'risks' && f.validated);
        return riskF
          ? (Array.isArray(riskF.value) ? riskF.value : [String(riskF.value)]).join('. ').slice(0, 500)
          : '';
      })();

  let recommendation = computeConsultantRecommendation(productionFields, verifiedNit);
  if (riskAnalysis?.overallLevel === 'High' && recommendation === 'Apply') {
    recommendation = 'Apply with Caution';
  }
  if (riskAnalysis?.overallLevel === 'High' && riskAnalysis.items.filter((i) => i.level === 'High').length >= 2) {
    recommendation = 'Do Not Apply';
  }
  const executiveBullets = buildExecutiveSummaryFromValidated(productionFields, recommendation);

  return {
    scopeSummary,
    eligibilitySummary,
    timelineSummary,
    financialSummary,
    riskSummary,
    recommendation,
    executiveBullets,
  };
}

export function computeConsultantRecommendation(
  fields: ExtractedProductionField[],
  nit: VerifiedNitJson
): FeasibilityRecommendation {
  const critical = [
    nit.tenderNumber,
    nit.estimatedTenderValue,
    nit.emdAmount,
    nit.bidSubmissionDate,
  ];
  const missing = critical.filter((v) => !v).length;
  if (missing >= 2) return 'Do Not Apply';
  if (missing >= 1) return 'Apply with Caution';
  const review = fields.filter((f) => f.needsReview).length;
  if (review >= 4) return 'Apply with Caution';
  return 'Apply';
}
