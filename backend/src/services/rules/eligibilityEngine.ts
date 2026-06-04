import { env } from '../../config/env';
import { IExtractedNitData } from '../../models/NitAnalysis';
import { IRuleCheck } from '../../models/EligibilityResult';
import { EligibilityStatus } from '../../types';
import { parseAmount, parseExperienceYears } from '../../utils/parseAmount';

export interface EligibilityEngineResult {
  status: EligibilityStatus;
  score: number;
  ruleChecks: IRuleCheck[];
  summary: string;
  recommendations: string[];
}

class EligibilityEngine {
  evaluate(extracted: IExtractedNitData): EligibilityEngineResult {
    const checks: IRuleCheck[] = [
      this.checkTurnover(extracted.turnoverRequirement),
      this.checkExperience(extracted.experienceRequirement),
      this.checkOem(extracted.oemRequirement),
      this.checkEmd(extracted.emdAmount),
      this.checkMsme(extracted.msmeRequirement),
      this.checkGst(extracted.gstRequirement),
      this.checkPan(extracted.panRequirement),
      this.checkIso(extracted.isoRequirement),
      this.checkTechnical(extracted.technicalRequirements),
    ];

    const passedCount = checks.filter((c) => c.passed).length;
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const earnedWeight = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
    const score = Math.round((earnedWeight / totalWeight) * 100);

    let status: EligibilityStatus;
    if (passedCount === checks.length) status = EligibilityStatus.ELIGIBLE;
    else if (passedCount >= checks.length * 0.6) status = EligibilityStatus.PARTIALLY_ELIGIBLE;
    else status = EligibilityStatus.NOT_ELIGIBLE;

    const failed = checks.filter((c) => !c.passed);
    const recommendations = failed.map((c) => `Address: ${c.message}`);

    return {
      status,
      score,
      ruleChecks: checks,
      summary: `${passedCount}/${checks.length} eligibility criteria met. Status: ${status}`,
      recommendations,
    };
  }

  private checkTurnover(requirement?: string): IRuleCheck {
    const required = parseAmount(requirement || '0');
    const passed = !required || env.company.turnover >= required;
    return {
      rule: 'Turnover Eligibility',
      passed,
      message: passed
        ? `Turnover meets requirement (Company: ${env.company.turnover})`
        : `Turnover below required ${requirement}`,
      weight: 15,
    };
  }

  private checkExperience(requirement?: string): IRuleCheck {
    const required = parseExperienceYears(requirement);
    const passed = !required || env.company.experienceYears >= required;
    return {
      rule: 'Experience Eligibility',
      passed,
      message: passed
        ? `Experience meets requirement (${env.company.experienceYears} years)`
        : `Insufficient experience. Required: ${requirement}`,
      weight: 15,
    };
  }

  private checkOem(requirement?: string): IRuleCheck {
    const requiresOem = requirement && !/not required|na|n\/a/i.test(requirement);
    return {
      rule: 'OEM Requirement',
      passed: !requiresOem,
      message: requiresOem ? `OEM authorization required: ${requirement}` : 'No OEM restriction',
      weight: 10,
    };
  }

  private checkEmd(emdAmount?: number): IRuleCheck {
    const passed = !emdAmount || emdAmount <= env.company.turnover * 0.05;
    return {
      rule: 'EMD Requirement',
      passed,
      message: passed ? `EMD amount manageable: Rs. ${emdAmount || 0}` : `EMD may strain liquidity: Rs. ${emdAmount}`,
      weight: 12,
    };
  }

  private checkMsme(requirement?: string): IRuleCheck {
    const prefersMsme = requirement && /msme|mii|preference/i.test(requirement);
    const passed = !prefersMsme || env.company.isMsme;
    return {
      rule: 'MSME Requirement',
      passed,
      message: passed ? 'MSME criteria satisfied' : 'MSME preference may affect scoring',
      weight: 8,
    };
  }

  private checkGst(requirement?: string): IRuleCheck {
    const required = requirement && !/not required|na/i.test(requirement);
    const passed = !required || env.company.hasGst;
    return {
      rule: 'GST Requirement',
      passed,
      message: passed ? 'GST compliance met' : 'Valid GST registration required',
      weight: 10,
    };
  }

  private checkPan(requirement?: string): IRuleCheck {
    const required = requirement && !/not required|na/i.test(requirement);
    const passed = !required || env.company.hasPan;
    return {
      rule: 'PAN Requirement',
      passed,
      message: passed ? 'PAN compliance met' : 'Valid PAN required',
      weight: 8,
    };
  }

  private checkIso(requirement?: string): IRuleCheck {
    const required = requirement && /iso/i.test(requirement);
    const passed = !required || env.company.hasIso;
    return {
      rule: 'ISO Requirement',
      passed,
      message: passed ? 'ISO certification available' : 'ISO certification required',
      weight: 12,
    };
  }

  private checkTechnical(requirements?: string[]): IRuleCheck {
    const hasRequirements = requirements && requirements.length > 0;
    return {
      rule: 'Technical Qualification',
      passed: true,
      message: hasRequirements
        ? `${requirements!.length} technical requirements to review`
        : 'No specific technical barriers identified',
      weight: 10,
    };
  }
}

export const eligibilityEngine = new EligibilityEngine();
