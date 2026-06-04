import { env } from '../../config/env';
import { IExtractedNitData } from '../../models/NitAnalysis';
import { IRuleCheck } from '../../models/EligibilityResult';
import { EligibilityStatus } from '../../types';
import { parseAmount, parseExperienceYears } from '../../utils/parseAmount';

export interface RuleEngineResult {
  status: EligibilityStatus;
  score: number;
  ruleChecks: IRuleCheck[];
  summary: string;
  recommendations: string[];
}

export const ruleEngine = {
  evaluate(extracted: IExtractedNitData): RuleEngineResult {
    const checks: IRuleCheck[] = [];
    const company = env.company;

    const requiredTurnover = parseAmount(extracted.turnoverRequirement);
    const turnoverPass = requiredTurnover === 0 || company.turnover >= requiredTurnover;
    checks.push({
      rule: 'Turnover Eligibility',
      passed: turnoverPass,
      message: turnoverPass
        ? `Company turnover meets requirement`
        : `Required turnover ${requiredTurnover}, company has ${company.turnover}`,
      weight: 15,
    });

    const requiredExp = parseExperienceYears(extracted.experienceRequirement);
    const expPass = requiredExp === 0 || company.experienceYears >= requiredExp;
    checks.push({
      rule: 'Experience Eligibility',
      passed: expPass,
      message: expPass
        ? 'Experience requirement met'
        : `Required ${requiredExp} years, company has ${company.experienceYears}`,
      weight: 15,
    });

    const oemRequired = /oem|authorized|manufacturer/i.test(extracted.oemRequirement || '');
    checks.push({
      rule: 'OEM Requirement',
      passed: !oemRequired,
      message: oemRequired ? 'OEM authorization may be required' : 'No strict OEM block',
      weight: 10,
    });

    const emdAmount = extracted.emdAmount || 0;
    checks.push({
      rule: 'EMD Requirement',
      passed: emdAmount < company.turnover * 0.05,
      message: `EMD amount: ${emdAmount}`,
      weight: 10,
    });

    const msmeRequired = /msme|udyam|small\s*enterprise/i.test(extracted.msmeRequirement || '');
    const msmePass = !msmeRequired || company.isMsme;
    checks.push({
      rule: 'MSME Requirement',
      passed: msmePass,
      message: msmePass ? 'MSME criteria satisfied' : 'MSME registration may be required',
      weight: 10,
    });

    const gstRequired = /gst|goods\s*and\s*services/i.test(extracted.gstRequirement || '');
    const gstPass = !gstRequired || company.hasGst;
    checks.push({
      rule: 'GST Requirement',
      passed: gstPass,
      message: gstPass ? 'GST compliance met' : 'Valid GST required',
      weight: 10,
    });

    const panRequired = /pan|permanent\s*account/i.test(extracted.panRequirement || '');
    const panPass = !panRequired || company.hasPan;
    checks.push({
      rule: 'PAN Requirement',
      passed: panPass,
      message: panPass ? 'PAN compliance met' : 'Valid PAN required',
      weight: 5,
    });

    const isoRequired = /iso|quality\s*management/i.test(extracted.isoRequirement || '');
    const isoPass = !isoRequired || company.hasIso;
    checks.push({
      rule: 'ISO Requirement',
      passed: isoPass,
      message: isoPass ? 'ISO certification available' : 'ISO certification may be required',
      weight: 10,
    });

    const techCount = extracted.technicalRequirements?.length || 0;
    checks.push({
      rule: 'Technical Requirement',
      passed: techCount <= 10,
      message: `${techCount} technical requirements identified`,
      weight: 15,
    });

    const passedWeight = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const score = Math.round((passedWeight / totalWeight) * 100);

    const passedCount = checks.filter((c) => c.passed).length;
    let status: EligibilityStatus;
    if (score >= 80 && passedCount >= checks.length - 1) {
      status = EligibilityStatus.ELIGIBLE;
    } else if (score >= 50) {
      status = EligibilityStatus.PARTIALLY_ELIGIBLE;
    } else {
      status = EligibilityStatus.NOT_ELIGIBLE;
    }

    const recommendations = checks
      .filter((c) => !c.passed)
      .map((c) => `Address: ${c.rule} - ${c.message}`);

    return {
      status,
      score,
      ruleChecks: checks,
      summary: `Eligibility: ${status} with score ${score}/100. ${passedCount}/${checks.length} rules passed.`,
      recommendations,
    };
  },

  calculateEligibilityScore(extracted: IExtractedNitData, ruleResult: RuleEngineResult): number {
    let score = ruleResult.score;
    if (extracted.requiredDocuments?.length) {
      const docPenalty = Math.min(extracted.requiredDocuments.length * 2, 15);
      score = Math.max(0, score - docPenalty / 2);
    }
    if (extracted.emdAmount && extracted.tenderValue) {
      const emdRatio = extracted.emdAmount / extracted.tenderValue;
      if (emdRatio > 0.05) score -= 5;
    }
    return Math.min(100, Math.max(0, Math.round(score)));
  },
};
