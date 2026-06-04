import { MasterTenderDataset, MasterDatasetStatistics } from '../../types/masterDataset';
import {
  ExecutiveRecommendation,
  ExecutiveRecommendationResult,
  FactorStatus,
  RecommendationFactor,
} from '../../types/executiveRecommendation';
import { TenderRiskAnalysisResult, TenderRiskItem, TenderRiskLevel } from '../../types/tenderRiskAnalysis';
import { env } from '../../config/env';
import { parseAmount, parseExperienceYears } from '../../utils/parseAmount';

const LOW_CONFIDENCE = 80;

interface DatasetField {
  value: string;
  confidence: number;
  sourcePage: number;
  found: boolean;
}

function pick(dataset: MasterTenderDataset, key: keyof MasterTenderDataset): DatasetField {
  const f = dataset[key];
  const found = !!f.value?.trim();
  return {
    value: found ? f.value.trim() : '',
    confidence: found ? f.confidence : 0,
    sourcePage: found && f.sourcePage > 0 ? f.sourcePage : 0,
    found,
  };
}

function riskLevel(risks: TenderRiskItem[], type: string): TenderRiskLevel {
  return risks.find((r) => r.riskType === type)?.level || 'LOW';
}

function riskReason(risks: TenderRiskItem[], type: string): string {
  return risks.find((r) => r.riskType === type)?.reason || '';
}

function makeFactor(
  factor: RecommendationFactor['factor'],
  status: FactorStatus,
  summary: string,
  detail: string,
  field?: DatasetField
): RecommendationFactor {
  return {
    factor,
    status,
    summary,
    detail,
    confidence: field?.found ? field.confidence : null,
    sourcePage: field?.found && field.sourcePage > 0 ? field.sourcePage : null,
  };
}

function computeDataQualityScore(stats: MasterDatasetStatistics): number {
  const populateRatio = stats.totalFields > 0 ? stats.populatedFields / stats.totalFields : 0;
  const confidenceComponent = stats.averageConfidence / 100;
  const lowConfPenalty = Math.min(0.3, (stats.lowConfidenceFields / Math.max(stats.totalFields, 1)) * 0.5);
  return Math.round(Math.max(0, Math.min(100, (populateRatio * 0.45 + confidenceComponent * 0.55 - lowConfPenalty) * 100)));
}

function resolveRecommendation(
  factors: RecommendationFactor[],
  overallRisk: TenderRiskLevel,
  dataQualityScore: number,
  risks: TenderRiskItem[]
): ExecutiveRecommendation {
  const criticalCount = factors.filter((f) => f.status === 'Critical').length;
  const concernCount = factors.filter((f) => f.status === 'Concern').length;
  const highRisks = risks.filter((r) => r.level === 'HIGH').length;
  const mediumRisks = risks.filter((r) => r.level === 'MEDIUM').length;

  const eligibilityRisk = riskLevel(risks, 'Eligibility Risk');
  const financialRisk = riskLevel(risks, 'Financial Risk');
  const timelineRisk = riskLevel(risks, 'Timeline Risk');

  if (
    criticalCount >= 2 ||
    (criticalCount >= 1 && eligibilityRisk === 'HIGH') ||
    (eligibilityRisk === 'HIGH' && financialRisk === 'HIGH') ||
    (overallRisk === 'HIGH' && eligibilityRisk === 'HIGH')
  ) {
    return 'Do Not Apply';
  }

  if (
    dataQualityScore < 55 ||
    criticalCount >= 1 ||
    highRisks >= 2 ||
    (overallRisk === 'HIGH' && timelineRisk === 'HIGH') ||
    concernCount >= 4
  ) {
    return 'Need Manual Review';
  }

  if (
    overallRisk === 'MEDIUM' ||
    mediumRisks >= 2 ||
    concernCount >= 2 ||
    dataQualityScore < 75 ||
    factors.some((f) => f.status === 'Concern' && f.confidence !== null && f.confidence < LOW_CONFIDENCE)
  ) {
    return 'Apply With Caution';
  }

  return 'Apply Immediately';
}

function buildExecutiveSummary(
  recommendation: ExecutiveRecommendation,
  factors: RecommendationFactor[],
  overallRisk: TenderRiskLevel,
  dataQualityScore: number
): string {
  const critical = factors.filter((f) => f.status === 'Critical').map((f) => f.factor);
  const concerns = factors.filter((f) => f.status === 'Concern').map((f) => f.factor);

  const parts: string[] = [
    `Executive recommendation: ${recommendation}.`,
    `Overall risk level is ${overallRisk} based on verified master dataset and risk analysis.`,
    `Data quality score: ${dataQualityScore}/100.`,
  ];

  if (critical.length) {
    parts.push(`Critical concerns: ${critical.join(', ')}.`);
  }
  if (concerns.length) {
    parts.push(`Areas requiring attention: ${concerns.join(', ')}.`);
  }

  switch (recommendation) {
    case 'Apply Immediately':
      parts.push('Verified parameters support a confident bid decision with standard due diligence.');
      break;
    case 'Apply With Caution':
      parts.push('Bid may proceed after addressing identified commercial, eligibility, or timeline concerns.');
      break;
    case 'Need Manual Review':
      parts.push('Procurement leadership should review gaps in verified data or elevated risk before committing resources.');
      break;
    case 'Do Not Apply':
      parts.push('Material disqualifiers or critical risk exposure identified — bidding is not recommended at this stage.');
      break;
  }

  return parts.join(' ');
}

export class ExecutiveRecommendationEngine {
  generate(
    dataset: MasterTenderDataset,
    stats: MasterDatasetStatistics,
    riskAnalysis: TenderRiskAnalysisResult
  ): ExecutiveRecommendationResult {
    const started = Date.now();
    const { risks, overallLevel: overallRiskLevel } = riskAnalysis;

    const tenderValue = pick(dataset, 'tenderValue');
    const estimatedCost = pick(dataset, 'estimatedCost');
    const valueField = tenderValue.found ? tenderValue : estimatedCost;

    const emd = pick(dataset, 'emdAmount');
    const eligibility = pick(dataset, 'eligibilityCriteria');
    const turnover = pick(dataset, 'turnoverRequirement');
    const experience = pick(dataset, 'experienceRequirement');
    const bidEnd = pick(dataset, 'bidEndDate');
    const completion = pick(dataset, 'completionPeriod');
    const certificates = pick(dataset, 'certificates');
    const perf = pick(dataset, 'performanceSecurity');

    const factors: RecommendationFactor[] = [];

    // Tender Value
    if (!valueField.found) {
      factors.push(
        makeFactor(
          'Tender Value',
          'Concern',
          'Tender value not verified',
          'Estimated tender value was not found in the verified master dataset. Commercial viability cannot be fully assessed.',
          valueField
        )
      );
    } else {
      const amount = parseAmount(valueField.value);
      const status: FactorStatus =
        valueField.confidence >= LOW_CONFIDENCE ? 'Favorable' : 'Concern';
      factors.push(
        makeFactor(
          'Tender Value',
          status,
          amount > 0 ? `Verified value: ${valueField.value}` : 'Tender value captured',
          amount > 0
            ? `Extracted tender value of ${valueField.value} is present in the verified dataset with ${valueField.confidence}% confidence.`
            : `Tender value field populated (${valueField.confidence}% confidence). Validate amount against BOQ before final bid pricing.`,
          valueField
        )
      );
    }

    // EMD
    const emdAmount = parseAmount(emd.value);
    if (!emd.found) {
      factors.push(
        makeFactor(
          'EMD',
          'Concern',
          'EMD not verified',
          'Earnest Money Deposit amount not found. EMD liquidity planning and BG arrangement cannot be confirmed.',
          emd
        )
      );
    } else if (emdAmount > 0 && emdAmount > env.company.turnover * 0.05) {
      factors.push(
        makeFactor(
          'EMD',
          'Critical',
          'EMD may strain liquidity',
          `EMD of ${emd.value} exceeds 5% of company turnover profile. ${riskReason(risks, 'Financial Risk')}`,
          emd
        )
      );
    } else {
      factors.push(
        makeFactor(
          'EMD',
          emd.confidence >= LOW_CONFIDENCE ? 'Favorable' : 'Concern',
          `EMD verified: ${emd.value}`,
          `EMD requirement is captured in the verified dataset. ${riskReason(risks, 'Financial Risk')}`,
          emd
        )
      );
    }

    // Eligibility Criteria
    if (!eligibility.found) {
      factors.push(
        makeFactor(
          'Eligibility Criteria',
          'Concern',
          'Eligibility criteria incomplete',
          'Core eligibility criteria not found in verified dataset. Bid qualification status is unconfirmed.',
          eligibility
        )
      );
    } else {
      const eligRisk = riskLevel(risks, 'Eligibility Risk');
      factors.push(
        makeFactor(
          'Eligibility Criteria',
          eligRisk === 'HIGH' ? 'Critical' : eligRisk === 'MEDIUM' ? 'Concern' : 'Favorable',
          eligRisk === 'LOW' ? 'Eligibility criteria verified' : 'Eligibility concerns identified',
          eligibility.value.length > 200 ? `${eligibility.value.slice(0, 200)}…` : eligibility.value,
          eligibility
        )
      );
    }

    // Turnover Requirements
    const requiredTurnover = parseAmount(turnover.value);
    if (!turnover.found) {
      factors.push(
        makeFactor(
          'Turnover Requirements',
          'Concern',
          'Turnover requirement not verified',
          'Annual turnover criteria not extracted. Confirm bidder meets financial qualification thresholds.',
          turnover
        )
      );
    } else if (requiredTurnover > 0 && env.company.turnover < requiredTurnover) {
      factors.push(
        makeFactor(
          'Turnover Requirements',
          'Critical',
          'Turnover threshold may not be met',
          `Required turnover ${turnover.value} exceeds company profile (₹${env.company.turnover.toLocaleString('en-IN')}).`,
          turnover
        )
      );
    } else {
      factors.push(
        makeFactor(
          'Turnover Requirements',
          'Favorable',
          turnover.value ? `Requirement: ${turnover.value}` : 'Turnover criteria captured',
          requiredTurnover > 0
            ? `Company turnover profile meets or exceeds stated requirement of ${turnover.value}.`
            : 'Turnover requirement documented in verified dataset for manual confirmation.',
          turnover
        )
      );
    }

    // Experience Requirements
    const requiredExp = parseExperienceYears(experience.value);
    if (!experience.found) {
      factors.push(
        makeFactor(
          'Experience Requirements',
          'Concern',
          'Experience requirement not verified',
          'Past experience criteria not extracted. Validate similar work orders and completion certificates.',
          experience
        )
      );
    } else if (requiredExp > 0 && env.company.experienceYears < requiredExp) {
      factors.push(
        makeFactor(
          'Experience Requirements',
          'Critical',
          'Experience threshold may not be met',
          `Required ${requiredExp} years experience exceeds company profile (${env.company.experienceYears} years).`,
          experience
        )
      );
    } else {
      factors.push(
        makeFactor(
          'Experience Requirements',
          'Favorable',
          experience.value ? `Requirement: ${experience.value}` : 'Experience criteria captured',
          requiredExp > 0
            ? `Company experience profile aligns with stated requirement of ${experience.value}.`
            : 'Experience requirement documented in verified dataset.',
          experience
        )
      );
    }

    // Timeline
    const timelineRisk = riskLevel(risks, 'Timeline Risk');
    if (!bidEnd.found && !completion.found) {
      factors.push(
        makeFactor(
          'Timeline',
          'Critical',
          'Critical dates missing',
          'Bid deadline and completion period not verified. Schedule risk is unacceptably high for automated recommendation.',
          bidEnd.found ? bidEnd : completion
        )
      );
    } else {
      factors.push(
        makeFactor(
          'Timeline',
          timelineRisk === 'HIGH' ? 'Critical' : timelineRisk === 'MEDIUM' ? 'Concern' : 'Favorable',
          timelineRisk === 'LOW' ? 'Timeline parameters verified' : 'Timeline pressure identified',
          [
            bidEnd.found ? `Submission deadline: ${bidEnd.value}` : 'Submission deadline not found',
            completion.found ? `Completion period: ${completion.value}` : '',
            riskReason(risks, 'Timeline Risk'),
          ]
            .filter(Boolean)
            .join('. '),
          bidEnd.found ? bidEnd : completion
        )
      );
    }

    // Compliance
    const complianceRisk = riskLevel(risks, 'Compliance Risk');
    if (!certificates.found && !perf.found) {
      factors.push(
        makeFactor(
          'Compliance',
          'Concern',
          'Compliance requirements incomplete',
          'Required certificates and performance security not verified in master dataset.',
          certificates
        )
      );
    } else {
      factors.push(
        makeFactor(
          'Compliance',
          complianceRisk === 'HIGH' ? 'Critical' : complianceRisk === 'MEDIUM' ? 'Concern' : 'Favorable',
          complianceRisk === 'LOW' ? 'Compliance requirements captured' : 'Compliance gaps identified',
          [
            certificates.found ? `Documents: ${certificates.value.slice(0, 150)}${certificates.value.length > 150 ? '…' : ''}` : '',
            perf.found ? `Performance security: ${perf.value}` : '',
            riskReason(risks, 'Compliance Risk'),
          ]
            .filter(Boolean)
            .join('. '),
          certificates.found ? certificates : perf
        )
      );
    }

    const dataQualityScore = computeDataQualityScore(stats);
    const recommendation = resolveRecommendation(factors, overallRiskLevel, dataQualityScore, risks);
    const executiveSummary = buildExecutiveSummary(recommendation, factors, overallRiskLevel, dataQualityScore);

    console.log('[ExecutiveRecommendation] Generated', {
      recommendation,
      overallRiskLevel,
      dataQualityScore,
      processingTimeMs: Date.now() - started,
    });

    return {
      recommendation,
      executiveSummary,
      factors,
      overallRiskLevel,
      dataQualityScore,
      dataSource: 'master_dataset',
      processingTimeMs: Date.now() - started,
    };
  }
}

export const executiveRecommendationEngine = new ExecutiveRecommendationEngine();
