import { MasterTenderDataset } from '../../types/masterDataset';
import {
  TenderRiskAnalysisResult,
  TenderRiskItem,
  TenderRiskLevel,
  TenderRiskPrerequisites,
} from '../../types/tenderRiskAnalysis';
import { env } from '../../config/env';
import { parseAmount, parseExperienceYears } from '../../utils/parseAmount';

const LOW_CONFIDENCE_THRESHOLD = 80;

interface DatasetField {
  value: string;
  confidence: number;
  found: boolean;
}

function pick(dataset: MasterTenderDataset, key: keyof MasterTenderDataset): DatasetField {
  const f = dataset[key];
  const found = !!f.value?.trim();
  return { value: found ? f.value.trim() : '', confidence: found ? f.confidence : 0, found };
}

function avgConfidence(fields: DatasetField[]): number {
  const found = fields.filter((f) => f.found);
  if (!found.length) return 0;
  return Math.round(found.reduce((s, f) => s + f.confidence, 0) / found.length);
}

function clampConfidence(n: number): number {
  return Math.max(35, Math.min(98, Math.round(n)));
}

function maxLevel(levels: TenderRiskLevel[]): TenderRiskLevel {
  if (levels.includes('HIGH')) return 'HIGH';
  if (levels.includes('MEDIUM')) return 'MEDIUM';
  return 'LOW';
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
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function lowConfidencePenalty(fields: DatasetField[]): number {
  return fields.filter((f) => f.found && f.confidence < LOW_CONFIDENCE_THRESHOLD).length * 8;
}

export class MasterDatasetRiskEngine {
  assertPrerequisites(prereq: TenderRiskPrerequisites): void {
    const missing: string[] = [];
    if (!prereq.extractionComplete) missing.push('Rule Extraction');
    if (!prereq.validationComplete) missing.push('Validation');
    if (!prereq.masterDatasetReady) missing.push('Master Dataset');
    if (missing.length) {
      throw new Error(
        `Risk analysis blocked — prerequisites incomplete: ${missing.join(', ')}. Complete extraction and validation first.`
      );
    }
  }

  analyze(dataset: MasterTenderDataset, prerequisites: TenderRiskPrerequisites): TenderRiskAnalysisResult {
    const started = Date.now();
    this.assertPrerequisites(prerequisites);

    const risks: TenderRiskItem[] = [
      this.analyzeFinancialRisk(dataset),
      this.analyzeTechnicalRisk(dataset),
      this.analyzeEligibilityRisk(dataset),
      this.analyzeTimelineRisk(dataset),
      this.analyzeComplianceRisk(dataset),
    ];

    return {
      risks,
      overallLevel: maxLevel(risks.map((r) => r.level)),
      prerequisites,
      dataSource: 'master_dataset',
      processingTimeMs: Date.now() - started,
    };
  }

  private analyzeFinancialRisk(dataset: MasterTenderDataset): TenderRiskItem {
    const emd = pick(dataset, 'emdAmount');
    const value = pick(dataset, 'tenderValue');
    const est = pick(dataset, 'estimatedCost');
    const perf = pick(dataset, 'performanceSecurity');
    const penalties = pick(dataset, 'penaltyClauses');
    const fields = [emd, value, est, perf, penalties, pick(dataset, 'documentFee'), pick(dataset, 'paymentTerms')];

    const missing: string[] = [];
    if (!emd.found) missing.push('EMD Amount');
    if (!value.found && !est.found) missing.push('Tender Value');
    if (!perf.found) missing.push('Performance Security');

    let level: TenderRiskLevel = 'LOW';
    let reason = 'Key financial parameters are present in the master dataset with acceptable confidence.';

    if (missing.length >= 2) {
      level = 'HIGH';
      reason = `Critical financial fields not found: ${missing.join(', ')}. Commercial exposure cannot be assessed reliably.`;
    } else if (missing.length === 1) {
      level = 'MEDIUM';
      reason = `${missing[0]} not extracted — review EMD, tender value, and security requirements before bidding.`;
    } else if (penalties.found && /liquidated|penalty|forfeit|ld\s/i.test(penalties.value)) {
      level = 'MEDIUM';
      reason = 'Penalty or liquidated damages clauses detected. Review financial exposure and cash-flow impact.';
    }

    const emdAmount = parseAmount(emd.value);
    if (emdAmount > 0 && emdAmount > env.company.turnover * 0.05) {
      level = 'HIGH';
      reason = `EMD (₹${emdAmount.toLocaleString('en-IN')}) may strain liquidity relative to company turnover profile.`;
    }

    let confidence = avgConfidence(fields.filter((f) => f.found));
    confidence -= missing.length * 12;
    confidence -= lowConfidencePenalty(fields);
    if (!fields.some((f) => f.found)) confidence = 45;

    return {
      riskType: 'Financial Risk',
      level,
      reason,
      confidence: clampConfidence(confidence),
    };
  }

  private analyzeTechnicalRisk(dataset: MasterTenderDataset): TenderRiskItem {
    const scope = pick(dataset, 'scopeOfWork');
    const equipment = pick(dataset, 'equipmentRequirement');
    const manpower = pick(dataset, 'manpowerRequirement');
    const fields = [scope, equipment, manpower];

    const complexScope =
      scope.found &&
      /cctv|surveillance|integration|oem|iso\s*9001|custom\s+development|turnkey|multi\s*site/i.test(
        scope.value
      );

    let level: TenderRiskLevel = 'LOW';
    let reason = 'Scope and resource requirements appear manageable based on extracted master dataset fields.';

    if (!scope.found) {
      level = 'HIGH';
      reason =
        'Scope of Work not found in master dataset. Technical deliverables and BOQ cannot be validated.';
    } else if (complexScope && (!equipment.found || !manpower.found)) {
      level = 'MEDIUM';
      reason =
        'Complex technical scope detected but equipment or manpower requirements are incomplete. Validate capacity and OEM authorizations.';
    } else if (complexScope) {
      level = 'MEDIUM';
      reason =
        'High-complexity scope (integration/OEM/turnkey signals). Ensure technical capacity and resource planning before bid.';
    } else if (!equipment.found && !manpower.found) {
      level = 'MEDIUM';
      reason = 'Equipment and manpower requirements not extracted — technical resource planning remains unverified.';
    }

    let confidence = avgConfidence(fields.filter((f) => f.found));
    confidence -= lowConfidencePenalty(fields);
    if (!scope.found) confidence = Math.min(confidence, 50);

    return {
      riskType: 'Technical Risk',
      level,
      reason,
      confidence: clampConfidence(confidence || 48),
    };
  }

  private analyzeEligibilityRisk(dataset: MasterTenderDataset): TenderRiskItem {
    const eligibility = pick(dataset, 'eligibilityCriteria');
    const turnover = pick(dataset, 'turnoverRequirement');
    const experience = pick(dataset, 'experienceRequirement');
    const fields = [eligibility, turnover, experience, pick(dataset, 'manpowerRequirement'), pick(dataset, 'equipmentRequirement')];

    const requiredTurnover = parseAmount(turnover.value);
    const requiredExp = parseExperienceYears(experience.value);
    const gaps: string[] = [];

    if (requiredTurnover > 0 && env.company.turnover < requiredTurnover) {
      gaps.push(
        `Turnover requirement (₹${requiredTurnover.toLocaleString('en-IN')}) exceeds company profile`
      );
    }
    if (requiredExp > 0 && env.company.experienceYears < requiredExp) {
      gaps.push(`Experience requirement (${requiredExp} years) may not be met`);
    }
    if (!turnover.found && !experience.found && !eligibility.found) {
      gaps.push('Eligibility criteria not found in master dataset');
    }
    if (!env.company.hasGst) gaps.push('Company GST compliance flag not set');
    if (
      !env.company.hasIso &&
      (eligibility.found || pick(dataset, 'certificates').found) &&
      /iso\s*9001|iso\s+cert/i.test(`${eligibility.value} ${pick(dataset, 'certificates').value}`)
    ) {
      gaps.push('ISO certification may be required per extracted eligibility data');
    }

    let level: TenderRiskLevel = 'LOW';
    let reason = 'Eligibility parameters align with available master dataset fields and company profile.';

    if (gaps.some((g) => g.includes('exceeds') || g.includes('may not be met'))) {
      level = 'HIGH';
      reason = gaps.join('. ') + '.';
    } else if (gaps.length > 0) {
      level = gaps.some((g) => g.includes('not found')) ? 'HIGH' : 'MEDIUM';
      reason = gaps.join('. ') + '.';
    }

    let confidence = avgConfidence(fields.filter((f) => f.found));
    confidence -= lowConfidencePenalty(fields);
    if (!turnover.found && !experience.found) confidence = Math.min(confidence, 52);

    return {
      riskType: 'Eligibility Risk',
      level,
      reason,
      confidence: clampConfidence(confidence || 46),
    };
  }

  private analyzeTimelineRisk(dataset: MasterTenderDataset): TenderRiskItem {
    const bidEnd = pick(dataset, 'bidEndDate');
    const bidStart = pick(dataset, 'bidStartDate');
    const completion = pick(dataset, 'completionPeriod');
    const contract = pick(dataset, 'contractPeriod');
    const fields = [
      bidEnd,
      bidStart,
      pick(dataset, 'publishingDate'),
      pick(dataset, 'technicalBidDate'),
      pick(dataset, 'financialBidDate'),
      pick(dataset, 'preBidMeetingDate'),
      completion,
      contract,
    ];

    const missing: string[] = [];
    if (!bidEnd.found) missing.push('bid submission deadline');
    if (!completion.found && !contract.found) missing.push('contract duration / completion period');

    let level: TenderRiskLevel = 'LOW';
    let reason = 'Timeline parameters are present in the master dataset and appear feasible.';

    if (missing.length >= 2) {
      level = 'HIGH';
      reason = `Critical timeline fields missing: ${missing.join(' and ')}. Deadline risk cannot be assessed.`;
    } else if (missing.length === 1) {
      level = 'MEDIUM';
      reason = `${missing[0]} not found — confirm schedule before bid submission.`;
    }

    const daysLeft = bidEnd.found ? parseDaysUntil(bidEnd.value) : null;
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) {
      level = 'HIGH';
      reason = `Bid submission deadline is within ${daysLeft} day(s) — insufficient preparation time.`;
    } else if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14) {
      if (level !== 'HIGH') level = 'MEDIUM';
      reason = `Bid submission in approximately ${daysLeft} days — accelerated timeline required.`;
    }

    const tight =
      completion.found && /short\s+period|tight|immediate|urgent|days?\s+only/i.test(completion.value);
    if (tight && level === 'LOW') {
      level = 'MEDIUM';
      reason = 'Extracted completion period indicates tight delivery or execution schedule.';
    }

    let confidence = avgConfidence(fields.filter((f) => f.found));
    confidence -= missing.length * 15;
    confidence -= lowConfidencePenalty(fields);

    return {
      riskType: 'Timeline Risk',
      level,
      reason,
      confidence: clampConfidence(confidence || 44),
    };
  }

  private analyzeComplianceRisk(dataset: MasterTenderDataset): TenderRiskItem {
    const certificates = pick(dataset, 'certificates');
    const perf = pick(dataset, 'performanceSecurity');
    const fields = [certificates, perf];

    const certText = certificates.value.toLowerCase();
    const requiresIso = /iso\s*9001|iso\s+cert/i.test(certText);
    const requiresGst = /gst|goods and services tax/i.test(certText);

    const gaps: string[] = [];
    if (!certificates.found) gaps.push('Required certificates / documents not found');
    if (!perf.found) gaps.push('Performance security requirement not found');
    if (requiresIso && !env.company.hasIso) gaps.push('ISO certification may be mandatory');
    if (requiresGst && !env.company.hasGst) gaps.push('GST registration may be mandatory');

    let level: TenderRiskLevel = 'LOW';
    let reason = 'Compliance requirements are captured in the master dataset with no major gaps detected.';

    if (gaps.length >= 2 || gaps.some((g) => g.includes('mandatory'))) {
      level = 'HIGH';
      reason = gaps.join('. ') + '.';
    } else if (gaps.length === 1) {
      level = 'MEDIUM';
      reason = gaps[0] + '.';
    } else if (certificates.found && certificates.value.split(/[,;|•\n]+/).filter(Boolean).length > 8) {
      level = 'MEDIUM';
      reason =
        'Extensive document/certification list extracted. Ensure all compliance documents can be assembled before deadline.';
    }

    let confidence = avgConfidence(fields.filter((f) => f.found));
    confidence -= lowConfidencePenalty(fields);
    if (!certificates.found) confidence = Math.min(confidence, 48);

    return {
      riskType: 'Compliance Risk',
      level,
      reason,
      confidence: clampConfidence(confidence || 45),
    };
  }
}

export const masterDatasetRiskEngine = new MasterDatasetRiskEngine();
