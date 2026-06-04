import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { PageText, MergedIntelligence, FeasibilityRecommendation } from '../../types/intelligence';
import { NitRiskItem } from '../../types/intelligence';
import {
  RiskAnalysisItem,
  RiskAnalysisPrerequisites,
  RiskAnalysisResult,
  RiskCategory,
  RiskLevel,
} from '../../types/riskAnalysis';
import { ExtractedProductionField } from '../intelligence/extractedProductionField';
import { VerifiedNitJson } from '../intelligence/verifiedNitJsonBuilder';
import { combineCorpus, getVerifiedFieldValue } from '../intelligence/executiveDisplayFormatter';
import { parseAmount, parseExperienceYears } from '../../utils/parseAmount';

export interface RiskAnalysisInput {
  pages: PageText[];
  productionFields: ExtractedProductionField[];
  verifiedNit: VerifiedNitJson;
  merged: MergedIntelligence;
  recommendation: FeasibilityRecommendation;
  stagesCompleted: string[];
}

function pick(fields: ExtractedProductionField[], ids: string[]): ExtractedProductionField | undefined {
  return fields.find((f) => ids.includes(f.id) && f.validated && f.value);
}

function avgConfidence(fields: ExtractedProductionField[]): number {
  if (!fields.length) return 0;
  const sum = fields.reduce((s, f) => s + f.confidence, 0);
  return Math.round((sum / fields.length) * 100);
}

function clampConfidence(n: number): number {
  return Math.max(35, Math.min(98, Math.round(n)));
}

function maxLevel(levels: RiskLevel[]): RiskLevel {
  if (levels.includes('High')) return 'High';
  if (levels.includes('Medium')) return 'Medium';
  return 'Low';
}

function parseDaysUntil(dateStr: string): number | null {
  const iso = dateStr.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const dmy = dateStr.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  let y: number, m: number, d: number;
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
    if (y < 100) y = y >= 70 ? 1900 + y : 2000 + y;
  } else {
    return null;
  }
  const target = new Date(Date.UTC(y, m - 1, d));
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export class RiskAnalysisEngine {
  checkPrerequisites(input: {
    pages: PageText[];
    productionFields: ExtractedProductionField[];
    stagesCompleted: string[];
  }): RiskAnalysisPrerequisites {
    const ocrComplete =
      input.pages.length > 0 &&
      input.pages.some((p) => (p.charCount || p.text?.length || 0) >= 40);

    const ruleExtractionComplete =
      input.stagesCompleted.some((s) => s.includes('step_2') || s.includes('step_5')) ||
      input.productionFields.length > 0;

    const validationComplete =
      input.stagesCompleted.includes('step_4_validation') ||
      input.stagesCompleted.includes('step_6_structured_json') ||
      input.productionFields.some((f) => f.validated);

    const openAiVerificationComplete =
      input.stagesCompleted.includes('step_5_ai_verification') ||
      input.stagesCompleted.includes('consultant_pipeline_complete');

    return {
      ocrComplete,
      ruleExtractionComplete,
      validationComplete,
      openAiVerificationComplete,
    };
  }

  assertPrerequisites(prereq: RiskAnalysisPrerequisites): void {
    const missing: string[] = [];
    if (!prereq.ocrComplete) missing.push('OCR');
    if (!prereq.ruleExtractionComplete) missing.push('Rule Extraction');
    if (!prereq.validationComplete) missing.push('Validation');
    if (!prereq.openAiVerificationComplete) missing.push('OpenAI Verification');
    if (missing.length) {
      throw new AppError(
        `Risk analysis blocked — prerequisites incomplete: ${missing.join(', ')}`,
        400
      );
    }
  }

  analyze(input: RiskAnalysisInput): RiskAnalysisResult {
    const started = Date.now();
    const prereq = this.checkPrerequisites(input);

    console.log('[RiskAnalysis] Start', {
      tenderFields: input.productionFields.length,
      prerequisites: prereq,
    });

    this.assertPrerequisites(prereq);

    const { productionFields, verifiedNit, recommendation } = input;
    const corpus = combineCorpus(productionFields);

    const financialFields = productionFields.filter(
      (f) => f.validated && f.section === 'financial'
    );
    const technicalFields = productionFields.filter(
      (f) => f.validated && f.section === 'technical'
    );
    const eligibilityFields = productionFields.filter(
      (f) => f.validated && f.section === 'eligibility'
    );
    const timelineFields = productionFields.filter(
      (f) => f.validated && f.section === 'timeline'
    );

    const items: RiskAnalysisItem[] = [
      this.analyzeFinancialRisk(productionFields, verifiedNit, corpus, financialFields),
      this.analyzeTechnicalRisk(productionFields, corpus, technicalFields),
      this.analyzeEligibilityRisk(productionFields, verifiedNit, eligibilityFields),
      this.analyzeTimelineRisk(productionFields, verifiedNit, timelineFields),
    ];

    if (recommendation === 'Do Not Apply') {
      for (const it of items) {
        if (it.level === 'Low') it.level = 'Medium';
      }
    }

    const overallLevel = maxLevel(items.map((i) => i.level));

    const result: RiskAnalysisResult = {
      items,
      overallLevel,
      prerequisites: prereq,
      processingTimeMs: Date.now() - started,
    };

    console.log('[RiskAnalysis] End', {
      overallLevel,
      processingTimeMs: result.processingTimeMs,
      items: items.map((i) => ({
        category: i.category,
        level: i.level,
        confidence: i.confidence,
      })),
    });

    return result;
  }

  toNitRiskItems(result: RiskAnalysisResult): NitRiskItem[] {
    return result.items.map((i) => ({
      category: i.category,
      level: i.level,
      note: i.explanation,
      explanation: i.explanation,
      confidence: i.confidence,
    }));
  }

  private analyzeFinancialRisk(
    fields: ExtractedProductionField[],
    nit: VerifiedNitJson,
    corpus: string,
    financialFields: ExtractedProductionField[]
  ): RiskAnalysisItem {
    const emdField = pick(fields, ['emdAmount']);
    const value = pick(fields, ['estimatedTenderValue']);
    const perf = pick(fields, ['performanceSecurity', 'bankGuarantee']);

    const missing: string[] = [];
    if (!emdField && !nit.emdAmount) missing.push('EMD');
    if (!value && !nit.estimatedTenderValue) missing.push('Tender Value');
    if (!perf && !nit.performanceSecurity) missing.push('Performance Security');

    const hasPenalties = /liquidated\s+damages|penalty|forfeit|ld\s+clause/i.test(corpus);

    let level: RiskLevel = 'Low';
    let explanation = 'Verified financial parameters are present with no major penalty clauses detected.';

    if (missing.length >= 2) {
      level = 'High';
      explanation = `Critical financial fields not verified: ${missing.join(', ')}. Commercial exposure cannot be assessed reliably.`;
    } else if (missing.length === 1) {
      level = 'Medium';
      explanation = `${missing[0]} not verified in the document — review EMD, tender value, and security requirements before bidding.`;
    } else if (hasPenalties) {
      level = 'Medium';
      explanation =
        'Penalty / liquidated damages clauses detected. Review financial exposure and cash-flow impact before commitment.';
    }

    const emdVal =
      nit.emdAmount ||
      (emdField ? String(Array.isArray(emdField.value) ? emdField.value[0] : emdField.value || '') : '');
    const emdAmount = parseAmount(emdVal || '');
    if (emdAmount > 0 && emdAmount > env.company.turnover * 0.05) {
      level = 'High';
      explanation = `EMD (₹${emdAmount.toLocaleString('en-IN')}) may strain liquidity relative to company turnover profile.`;
    }

    let confidence = avgConfidence(financialFields);
    if (missing.length) confidence -= missing.length * 12;
    if (!financialFields.length) confidence = 45;

    return {
      category: 'Financial Risk',
      level,
      explanation,
      confidence: clampConfidence(confidence),
    };
  }

  private analyzeTechnicalRisk(
    fields: ExtractedProductionField[],
    corpus: string,
    technicalFields: ExtractedProductionField[]
  ): RiskAnalysisItem {
    const techList = fields.filter((f) => f.id === 'technicalRequirements' && f.validated);
    const itemCount = techList.length
      ? (Array.isArray(techList[0].value) ? techList[0].value.length : 1)
      : 0;

    const complexScope = /cctv|surveillance|integration|oem|iso\s*9001|custom\s+development/i.test(
      corpus
    );

    let level: RiskLevel = 'Low';
    let explanation = 'Technical requirements are captured and appear manageable from verified data.';

    if (itemCount === 0) {
      level = 'Medium';
      explanation =
        'Technical requirements were not fully verified in the NIT. Validate specifications, BOQ, and compliance before bid preparation.';
    } else if (itemCount > 12 || complexScope) {
      level = 'Medium';
      explanation = `High technical scope (${itemCount}+ requirement signals). Ensure capacity, OEM authorizations, and resource planning.`;
    }

    let confidence = avgConfidence(technicalFields);
    if (itemCount === 0) confidence = Math.min(confidence, 55);

    return {
      category: 'Technical Risk',
      level,
      explanation,
      confidence: clampConfidence(confidence),
    };
  }

  private analyzeEligibilityRisk(
    fields: ExtractedProductionField[],
    nit: VerifiedNitJson,
    eligibilityFields: ExtractedProductionField[]
  ): RiskAnalysisItem {
    const turnoverReq =
      nit.turnoverRequirement ||
      getVerifiedFieldValue(fields, ['turnoverRequirements'])?.value ||
      '';
    const expReq =
      nit.experienceRequirement ||
      getVerifiedFieldValue(fields, ['experienceRequirements'])?.value ||
      '';

    const requiredTurnover = parseAmount(turnoverReq);
    const requiredExp = parseExperienceYears(expReq);

    const gaps: string[] = [];

    if (requiredTurnover > 0 && env.company.turnover < requiredTurnover) {
      gaps.push(
        `Turnover requirement (₹${requiredTurnover.toLocaleString('en-IN')}) exceeds company profile`
      );
    }
    if (requiredExp > 0 && env.company.experienceYears < requiredExp) {
      gaps.push(`Experience requirement (${requiredExp} years) may not be met`);
    }
    if (!turnoverReq && !expReq) {
      gaps.push('Experience / turnover criteria not verified in document');
    }
    if (!env.company.hasGst) gaps.push('GST compliance flag not set for company');
    if (!env.company.hasIso && /iso\s*9001|iso\s+cert/i.test(combineCorpus(fields))) {
      gaps.push('ISO certification may be required');
    }

    let level: RiskLevel = 'Low';
    let explanation = 'Core eligibility parameters align with available verified NIT data and company profile.';

    if (gaps.some((g) => g.includes('exceeds') || g.includes('may not be met'))) {
      level = 'High';
      explanation = gaps.join('. ') + '.';
    } else if (gaps.length > 0) {
      level = gaps.some((g) => g.includes('not verified')) ? 'High' : 'Medium';
      explanation = gaps.join('. ') + '.';
    }

    let confidence = avgConfidence(eligibilityFields);
    if (!turnoverReq && !expReq) confidence = Math.min(confidence, 50);

    return {
      category: 'Eligibility Risk',
      level,
      explanation,
      confidence: clampConfidence(confidence),
    };
  }

  private analyzeTimelineRisk(
    fields: ExtractedProductionField[],
    nit: VerifiedNitJson,
    timelineFields: ExtractedProductionField[]
  ): RiskAnalysisItem {
    const submission =
      nit.bidSubmissionDate ||
      getVerifiedFieldValue(fields, ['bidSubmissionDate'])?.value ||
      '';
    const duration =
      nit.contractDuration ||
      getVerifiedFieldValue(fields, ['contractDuration'])?.value ||
      '';

    const missing: string[] = [];
    if (!submission) missing.push('bid submission deadline');
    if (!duration) missing.push('contract duration / completion period');

    const corpus = combineCorpus(fields);
    const tight = /short\s+period|tight\s+schedule|immediate\s+start|urgent/i.test(corpus);

    let level: RiskLevel = 'Low';
    let explanation = 'Timeline parameters are verified and appear feasible from extracted dates.';

    if (missing.length >= 2) {
      level = 'High';
      explanation = `Critical timeline fields missing: ${missing.join(' and ')}. Deadline risk cannot be assessed.`;
    } else if (missing.length === 1) {
      level = 'Medium';
      explanation = `${missing[0]} not verified — confirm schedule before bid submission.`;
    }

    const daysLeft = submission ? parseDaysUntil(String(submission)) : null;
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) {
      level = 'High';
      explanation = `Bid submission deadline is within ${daysLeft} day(s) — insufficient preparation time.`;
    } else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14) {
      if (level !== 'High') level = 'Medium';
      explanation = `Bid submission in approximately ${daysLeft} days — accelerated timeline required.`;
    }

    if (tight && level === 'Low') {
      level = 'Medium';
      explanation = 'Document indicates tight delivery or execution schedule.';
    }

    let confidence = avgConfidence(timelineFields);
    if (missing.length) confidence -= missing.length * 15;

    return {
      category: 'Timeline Risk',
      level,
      explanation,
      confidence: clampConfidence(confidence),
    };
  }
}

export const riskAnalysisEngine = new RiskAnalysisEngine();
