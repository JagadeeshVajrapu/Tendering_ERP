import {
  FeasibilityRecommendation,
  MergedIntelligence,
} from '../../types/intelligence';
import { ExtractedProductionField } from './fieldExtractionEngine';
import { MANDATORY_FIELDS } from './fields';
import { isVerifiedField, verifiedScalar } from './fieldVerification';

function fieldLine(f: ExtractedProductionField): string {
  const v = Array.isArray(f.value) ? f.value.join('; ') : String(f.value);
  return `${f.label}: ${v}`;
}

class FeasibilityFromIntelligence {
  /** Summaries built only from independently validated production fields. */
  buildSummaries(
    merged: MergedIntelligence,
    productionFields: ExtractedProductionField[]
  ): {
    scopeSummary: string;
    eligibilitySummary: string;
    timelineSummary: string;
    financialSummary: string;
    riskSummary: string;
    recommendation: FeasibilityRecommendation;
  } {
    const scopeF = productionFields.find((f) => f.id === 'scopeOfWork' && f.validated);
    const scopeSummary = scopeF
      ? String(Array.isArray(scopeF.value) ? scopeF.value[0] : scopeF.value).slice(0, 400)
      : isVerifiedField(merged.scopeOfWork)
        ? verifiedScalar(merged.scopeOfWork) || ''
        : '';

    const eligibilitySummary =
      productionFields
        .filter((f) => f.section === 'eligibility' && f.validated)
        .map(fieldLine)
        .join('. ')
        .slice(0, 600) || '';

    const timelineSummary =
      productionFields
        .filter((f) => f.section === 'timeline' && f.validated)
        .map(fieldLine)
        .join('. ')
        .slice(0, 500) || '';

    const financialSummary =
      productionFields
        .filter((f) => f.section === 'financial' && f.validated)
        .map(fieldLine)
        .join('. ')
        .slice(0, 600) || '';

    const riskF = productionFields.find((f) => f.id === 'risks' && f.validated);
    const riskSummary = riskF
      ? (Array.isArray(riskF.value) ? riskF.value : [String(riskF.value)]).join('. ').slice(0, 500)
      : '';

    return {
      scopeSummary,
      eligibilitySummary,
      timelineSummary,
      financialSummary,
      riskSummary,
      recommendation: this.computeRecommendation(merged, productionFields),
    };
  }

  private computeRecommendation(
    merged: MergedIntelligence,
    productionFields: ExtractedProductionField[]
  ): FeasibilityRecommendation {
    const mandatoryIds = [
      'tenderName',
      'tenderNumber',
      'emdAmount',
      'estimatedTenderValue',
      'bidSubmissionDate',
      'contractDuration',
      'turnoverRequirements',
      'experienceRequirements',
    ];
    const missingMandatory = mandatoryIds.filter((id) => {
      const pf = productionFields.find((f) => f.id === id);
      if (pf) return !pf.validated;
      return !isVerifiedField(merged[id as keyof MergedIntelligence]);
    });

    const reviewCount = productionFields.filter((f) => f.needsReview).length;

    if (missingMandatory.length >= 3) return 'Do Not Apply';
    if (missingMandatory.length >= 1 || reviewCount >= 4) return 'Apply with Caution';
    return 'Apply';
  }

  /** No AI rewrite — validated field data only. */
  async enhanceWithAi(
    summaries: ReturnType<FeasibilityFromIntelligence['buildSummaries']>
  ): Promise<ReturnType<FeasibilityFromIntelligence['buildSummaries']>> {
    return summaries;
  }
}

export const feasibilityFromIntelligence = new FeasibilityFromIntelligence();
