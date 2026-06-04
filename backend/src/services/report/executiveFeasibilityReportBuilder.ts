import { ITenderIntelligence } from '../../models/TenderIntelligence';
import {
  FeasibilityRecommendation,
  NitAnalysisSheet,
} from '../../types/intelligence';
import { ExtractedProductionField } from '../intelligence/fieldExtractionEngine';

export type EligibilityStatus =
  | 'Likely Eligible'
  | 'Partially Eligible'
  | 'High Risk Eligibility';

export type ExecutiveRecommendationLabel =
  | 'APPLY'
  | 'APPLY WITH CAUTION'
  | 'DO NOT APPLY';

export interface TimelineRow {
  milestone: string;
  date: string;
}

export interface ExecutiveFeasibilityReport {
  tenderName: string;
  organization: string;
  tenderValue?: string;
  contractDuration?: string;
  overviewLines: string[];
  scopeBullets: string[];
  eligibilityBullets: string[];
  eligibilityStatus: EligibilityStatus;
  timelineRows: TimelineRow[];
  keyRisks: string[];
  recommendation: ExecutiveRecommendationLabel;
  recommendationJustification: string;
}

const ELIGIBILITY_FIELD_IDS = new Set([
  'turnoverRequirements',
  'experienceRequirements',
  'gstRequirement',
  'epfRequirement',
  'esiRequirement',
  'labourLicense',
]);

const LEGAL_NOISE =
  /\b(?:hereinafter|whereas|notwithstanding|aforesaid|pursuant to|shall mean|the bidder shall|bidder shall|as per nit|refer annexure)\b/gi;
const CLAUSE_REF = /\b(?:clause|section|annexure|appendix|schedule)\s*[\d.]+[a-z]?\b/gi;
const PAGE_REF = /\bpage\s*\d+\b/gi;

function fieldValue(f?: ExtractedProductionField | null): string | null {
  if (!f?.validated || !f.value) return null;
  const v = Array.isArray(f.value) ? f.value.join('; ') : String(f.value);
  const t = v.trim();
  return t || null;
}

function sanitize(text: string, maxLen = 140): string {
  let s = text
    .replace(PAGE_REF, '')
    .replace(CLAUSE_REF, '')
    .replace(LEGAL_NOISE, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) {
    const cut = s.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    s = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + '…';
  }
  return s;
}

function toBullet(label: string, raw: string): string {
  const v = sanitize(raw, 120);
  if (!v) return '';
  const lower = v.toLowerCase();
  if (lower.startsWith(label.toLowerCase())) return v;
  return `${label}: ${v}`;
}

function scopeToBullets(scopeText: string): string[] {
  const cleaned = sanitize(scopeText, 600);
  const parts = cleaned
    .split(/(?:\n|;|(?<=\.)\s+)/)
    .map((p) => p.replace(/^[\d.)]+\s*/, '').trim())
    .filter((p) => p.length > 15 && !/^(the|a|an)\s/i.test(p));

  const bullets: string[] = [];
  for (const p of parts) {
    const line = sanitize(p, 130);
    if (!line) continue;
    if (/supply|procurement|installation|maintenance|construction|services/i.test(line)) {
      bullets.push(line.charAt(0).toUpperCase() + line.slice(1));
    } else if (/objective|purpose|aim/i.test(line)) {
      bullets.push(`Project objective: ${line}`);
    } else {
      bullets.push(`Work includes ${line.charAt(0).toLowerCase()}${line.slice(1)}`);
    }
    if (bullets.length >= 5) break;
  }

  if (bullets.length === 0 && cleaned.length > 20) {
    bullets.push(sanitize(cleaned, 130));
  }
  return bullets.slice(0, 5);
}

function inferScopeBullets(
  fields: ExtractedProductionField[],
  tables?: NitAnalysisSheet | null
): string[] {
  const scopeF = fields.find((f) => f.id === 'scopeOfWork' && f.validated);
  const scopeVal = fieldValue(scopeF);
  if (scopeVal) return scopeToBullets(scopeVal);

  const name = fieldValue(fields.find((f) => f.id === 'tenderName'));
  if (name) {
    return [
      sanitize(`Engagement covers ${name}`, 130),
      'Detailed scope to be confirmed from tender document before bid preparation.',
    ].slice(0, 5);
  }

  const tech = tables?.technicalRequirements?.[0]?.value;
  if (tech) {
    return [sanitize(`Technical scope: ${tech}`, 130)].slice(0, 5);
  }

  return ['Scope details were not clearly identified in the extracted tender summary.'];
}

function buildEligibilityBullets(fields: ExtractedProductionField[]): string[] {
  const bullets: string[] = [];
  for (const f of fields) {
    if (!ELIGIBILITY_FIELD_IDS.has(f.id) || !f.validated) continue;
    const v = fieldValue(f);
    if (!v) continue;
    bullets.push(toBullet(f.label.replace(/ Requirement$/i, ''), v));
  }
  return bullets
    .filter(Boolean)
    .slice(0, 8);
}

function computeEligibilityStatus(
  fields: ExtractedProductionField[],
  recommendation: FeasibilityRecommendation
): EligibilityStatus {
  const eligFields = fields.filter((f) => ELIGIBILITY_FIELD_IDS.has(f.id));
  const validated = eligFields.filter((f) => f.validated);
  const reviewCount = eligFields.filter((f) => f.needsReview).length;
  const missingCore = ['experienceRequirements', 'turnoverRequirements'].filter(
    (id) => !fields.some((f) => f.id === id && f.validated)
  ).length;

  if (recommendation === 'Do Not Apply' || missingCore >= 2 || reviewCount >= 3) {
    return 'High Risk Eligibility';
  }
  if (
    recommendation === 'Apply with Caution' ||
    missingCore >= 1 ||
    reviewCount >= 1 ||
    validated.length < 2
  ) {
    return 'Partially Eligible';
  }
  return 'Likely Eligible';
}

function tableParam(tables: NitAnalysisSheet | undefined, param: string): string | undefined {
  const row = tables?.timelineInformation?.find(
    (r) => r.parameter.toLowerCase() === param.toLowerCase()
  );
  return row?.value;
}

function buildTimelineRows(
  fields: ExtractedProductionField[],
  tables?: NitAnalysisSheet | null
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const add = (milestone: string, id: string, tableLabel?: string) => {
    const f = fields.find((x) => x.id === id && x.validated);
    const v = fieldValue(f) || (tableLabel ? tableParam(tables ?? undefined, tableLabel) : null);
    if (v) rows.push({ milestone, date: sanitize(v, 50) });
  };

  add('Bid Submission Date', 'bidSubmissionDate', 'Bid Submission Date');
  add('Bid Opening Date', 'bidOpeningDate', 'Bid Opening Date');
  add('Contract Duration', 'contractDuration', 'Contract Duration');
  add('Pre-Bid Meeting', 'preBidMeetingDate', 'Pre-Bid Meeting Date');

  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.milestone;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function parseMoneyHint(text: string): number | null {
  const m = text.match(/([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|lac)/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const unit = m[2].toLowerCase();
  if (unit.startsWith('cr')) return n * 1e7;
  return n * 1e5;
}

function deriveExecutiveRisks(
  fields: ExtractedProductionField[],
  timelineRows: TimelineRow[],
  eligibilityStatus: EligibilityStatus
): string[] {
  const risks: string[] = [];

  const submission = timelineRows.find((r) => /submission/i.test(r.milestone));
  if (submission?.date) {
    const d = new Date(submission.date);
    if (!Number.isNaN(d.getTime())) {
      const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 10) {
        risks.push(`Bid submission deadline is within ${days} days — limited preparation time.`);
      }
    }
  }

  const turnover = fieldValue(fields.find((f) => f.id === 'turnoverRequirements'));
  if (turnover) {
    const amt = parseMoneyHint(turnover);
    if (amt && amt >= 5e7) {
      risks.push('Turnover requirement appears substantial — confirm company financials meet threshold.');
    } else if (/crore|lakh|%/i.test(turnover)) {
      risks.push('Financial qualification (turnover) may be demanding for mid-size bidders.');
    }
  }

  const experience = fieldValue(fields.find((f) => f.id === 'experienceRequirements'));
  if (experience && /(\d+)\s*years?|similar\s+work|completed.*projects/i.test(experience)) {
    risks.push('Experience criteria appear strict — validate past project references early.');
  }

  const statutory = ['gstRequirement', 'epfRequirement', 'esiRequirement', 'labourLicense'].filter(
    (id) => fields.some((f) => f.id === id && f.validated)
  );
  if (statutory.length >= 3) {
    risks.push('Multiple statutory registrations required — allow time for compliance verification.');
  }

  const emd = fieldValue(fields.find((f) => f.id === 'emdAmount'));
  const value = fieldValue(fields.find((f) => f.id === 'estimatedTenderValue'));
  if (emd && value) {
    risks.push('EMD and tender value obligations apply — assess cash flow before committing.');
  } else if (emd) {
    risks.push('Earnest money deposit required — confirm liquidity for bid security.');
  }

  const reviewCount = fields.filter((f) => f.needsReview).length;
  if (reviewCount >= 3) {
    risks.push('Several tender parameters need manual verification before final decision.');
  }

  if (eligibilityStatus === 'High Risk Eligibility' && risks.length < 5) {
    risks.push('Eligibility gaps or missing data increase risk of disqualification.');
  }

  if (risks.length === 0) {
    risks.push('Standard tender risks apply — conduct detailed review before bid submission.');
  }

  return [...new Set(risks)].slice(0, 5);
}

function mapRecommendation(rec: FeasibilityRecommendation): ExecutiveRecommendationLabel {
  if (rec === 'Apply') return 'APPLY';
  if (rec === 'Do Not Apply') return 'DO NOT APPLY';
  return 'APPLY WITH CAUTION';
}

function buildJustification(
  rec: ExecutiveRecommendationLabel,
  eligibilityStatus: EligibilityStatus,
  risks: string[],
  fields: ExtractedProductionField[]
): string {
  const missing = ['tenderName', 'bidSubmissionDate', 'experienceRequirements', 'turnoverRequirements'].filter(
    (id) => !fields.some((f) => f.id === id && f.validated)
  );

  if (rec === 'DO NOT APPLY') {
    return `Critical tender information is incomplete or eligibility appears weak (${eligibilityStatus.toLowerCase()}). ${
      missing.length ? `Missing: ${missing.slice(0, 3).join(', ')}.` : ''
    } Pursuing this bid may not be advisable without further diligence.`.trim();
  }
  if (rec === 'APPLY WITH CAUTION') {
    return `${eligibilityStatus}. ${risks[0] || 'Some requirements need verification.'} Proceed only after management confirms capacity and compliance readiness.`;
  }
  return `${eligibilityStatus}. Core tender parameters are available and risks appear manageable. Recommend proceeding with structured bid preparation and internal sign-off.`;
}

export function buildExecutiveFeasibilityReport(
  intelligence: ITenderIntelligence
): ExecutiveFeasibilityReport {
  const fields = (intelligence.productionFields || []) as ExtractedProductionField[];
  const tables = intelligence.nitTables;
  const md = intelligence.mdReport;

  const recommendation =
    intelligence.recommendation || md?.recommendation || 'Apply with Caution';

  const tenderName =
    fieldValue(fields.find((f) => f.id === 'tenderName')) ||
    tables?.generalInformation.find((r) => r.parameter === 'Tender Name')?.value ||
    'Tender';

  const organization =
    fieldValue(fields.find((f) => f.id === 'organization')) ||
    tables?.generalInformation.find((r) => r.parameter === 'Organization')?.value ||
    '';

  const tenderValue =
    fieldValue(fields.find((f) => f.id === 'estimatedTenderValue')) ||
    tables?.financialInformation.find((r) => /value|amount/i.test(r.parameter))?.value;

  const contractDuration =
    fieldValue(fields.find((f) => f.id === 'contractDuration')) ||
    tables?.timelineInformation.find((r) => /duration|period/i.test(r.parameter))?.value;

  const overviewLines: string[] = [];
  overviewLines.push(`Tender: ${sanitize(tenderName, 100)}`);
  if (organization) overviewLines.push(`Organization: ${sanitize(organization, 80)}`);
  if (tenderValue) overviewLines.push(`Estimated Value: ${sanitize(tenderValue, 60)}`);
  if (contractDuration) overviewLines.push(`Contract Duration: ${sanitize(contractDuration, 60)}`);

  const scopeBullets = inferScopeBullets(fields, tables);
  const eligibilityBullets = buildEligibilityBullets(fields);
  const eligibilityStatus = computeEligibilityStatus(fields, recommendation);
  const timelineRows = buildTimelineRows(fields, tables);
  const keyRisks = deriveExecutiveRisks(fields, timelineRows, eligibilityStatus);
  const execRec = mapRecommendation(recommendation);
  const recommendationJustification = sanitize(
    buildJustification(execRec, eligibilityStatus, keyRisks, fields),
    400
  );

  return {
    tenderName: sanitize(tenderName, 100),
    organization: sanitize(organization, 80),
    tenderValue: tenderValue ? sanitize(tenderValue, 60) : undefined,
    contractDuration: contractDuration ? sanitize(contractDuration, 60) : undefined,
    overviewLines: overviewLines.slice(0, 5),
    scopeBullets,
    eligibilityBullets:
      eligibilityBullets.length > 0
        ? eligibilityBullets
        : ['Eligibility criteria were not clearly identified — manual review of tender document required.'],
    eligibilityStatus,
    timelineRows:
      timelineRows.length > 0
        ? timelineRows
        : [{ milestone: 'Timeline', date: 'Dates not confirmed from document' }],
    keyRisks,
    recommendation: execRec,
    recommendationJustification,
  };
}
