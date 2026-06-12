import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';
import { DynamicChecklistResult } from '../../types/dynamicChecklist';
import { TenderRiskAnalysisResult } from '../../types/tenderRiskAnalysis';
import {
  AiRecommendationSection,
  ChecklistReadinessSection,
  EligibilitySummarySection,
  EnterpriseFeasibilityRecommendation,
  EnterpriseFeasibilityReport,
  ExperienceMatchingSection,
  FinancialSummarySection,
  ManpowerRequirementsSection,
  RiskAnalysisSection,
  ScopeSummarySection,
  TenderOverviewSection,
  TimelineSummarySection,
} from '../../types/enterpriseFeasibilityReport';
import { enterpriseMasterDatasetAccess } from '../masterTenderDataset/enterpriseMasterDatasetAccess';
import { parseAmount } from '../../utils/parseAmount';

export const ENTERPRISE_FEASIBILITY_SCHEMA_VERSION = 1;

const MANPOWER_PATTERNS: Array<{ role: string; terms: string[] }> = [
  { role: 'Security Guards', terms: ['security guard', 'guards', 'security personnel'] },
  { role: 'Supervisors', terms: ['supervisor', 'supervisors'] },
  { role: 'Housekeeping Staff', terms: ['housekeeping', 'housekeeping staff', 'cleaner'] },
  { role: 'Drivers', terms: ['driver', 'drivers'] },
  { role: 'Technicians', terms: ['technician', 'technicians'] },
  { role: 'Operators', terms: ['operator', 'operators'] },
  { role: 'Helpers', terms: ['helper', 'helpers', 'labour', 'labor'] },
  { role: 'Gardeners', terms: ['gardener', 'horticulture staff'] },
];

function pick(params: EnterpriseMasterDatasetEntry[], ...terms: string[]): string {
  return enterpriseMasterDatasetAccess.pickValue(params, ...terms);
}

function pickAll(params: EnterpriseMasterDatasetEntry[], ...terms: string[]): EnterpriseMasterDatasetEntry[] {
  const norms = terms.map((t) => t.toLowerCase());
  return params.filter((p) => {
    const hay = `${p.parameter} ${p.normalizedParameter} ${p.value}`.toLowerCase();
    return norms.some((t) => hay.includes(t));
  });
}

function toBullets(text: string, max = 10): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/(?:\n|;|(?<=\.)\s+)/)
    .map((s) => s.replace(/^[\d.)•\-]+\s*/, '').trim())
    .filter((s) => s.length > 12)
    .slice(0, max);
}

function buildOverview(params: EnterpriseMasterDatasetEntry[], serviceCategory: string): TenderOverviewSection {
  return {
    tenderNumber: pick(params, 'tender number', 'nit number', 'tender no'),
    organization: pick(params, 'organization', 'department', 'authority', 'buyer'),
    tenderTitle: pick(params, 'tender title', 'name of work', 'work name', 'title'),
    serviceCategory,
    location: pick(params, 'location', 'district', 'state', 'site'),
    tenderValue: pick(params, 'tender value', 'estimated value', 'contract value', 'estimated cost'),
    emdAmount: pick(params, 'emd', 'earnest money'),
    tenderFee: pick(params, 'tender fee', 'document fee', 'processing fee'),
    completionPeriod: pick(params, 'completion period', 'contract period', 'duration'),
    contractPeriod: pick(params, 'contract period', 'period of contract'),
    bidSubmissionEndDate: pick(params, 'bid end', 'bid submission', 'last date', 'closing date'),
  };
}

function buildScope(params: EnterpriseMasterDatasetEntry[]): ScopeSummarySection {
  const scopeText = pick(params, 'scope', 'scope of work', 'work description', 'services required');
  const deliverables = pick(params, 'deliverable', 'deliverables');
  const deployment = pick(params, 'deployment', 'manpower deployment', 'deployment scope');
  const special = pickAll(params, 'special condition', 'special requirement', 'condition');

  const bullets: string[] = [];
  bullets.push(...toBullets(scopeText, 4));
  if (deliverables) bullets.push(`Deliverables: ${deliverables}`);
  if (deployment) bullets.push(`Deployment: ${deployment}`);
  for (const s of special.slice(0, 3)) {
    bullets.push(`${s.parameter}: ${s.value}`);
  }

  const dynamicScope = params.filter(
    (p) => p.category === 'Scope' && p.parameterType === 'dynamic' && p.value?.trim()
  );
  for (const d of dynamicScope) {
    if (bullets.length >= 10) break;
    bullets.push(`${d.parameter}: ${d.value}`);
  }

  return { bullets: bullets.slice(0, 10) };
}

function buildManpower(params: EnterpriseMasterDatasetEntry[]): ManpowerRequirementsSection {
  const items: ManpowerRequirementsSection['items'] = [];
  const seen = new Set<string>();

  for (const pattern of MANPOWER_PATTERNS) {
    const match = params.find((p) => {
      const hay = `${p.parameter} ${p.normalizedParameter}`.toLowerCase();
      return pattern.terms.some((t) => hay.includes(t));
    });
    if (match) {
      items.push({ role: pattern.role, count: match.value, source: match.parameter });
      seen.add(pattern.role);
    }
  }

  const dynamicManpower = params.filter((p) => {
    const hay = `${p.parameter} ${p.value}`.toLowerCase();
    return /manpower|staff|headcount|personnel|count|number of|nos\.|guards|workers/i.test(hay);
  });

  for (const d of dynamicManpower) {
    const role = d.parameter;
    if (seen.has(role)) continue;
    seen.add(role);
    items.push({ role, count: d.value, source: 'dynamic_parameter' });
  }

  let total = 0;
  for (const item of items) {
    const n = parseInt(item.count.replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(n)) total += n;
  }

  return {
    items,
    totalEstimated: total > 0 ? String(total) : pick(params, 'total manpower', 'manpower') || '—',
  };
}

function buildEligibility(params: EnterpriseMasterDatasetEntry[]): EligibilitySummarySection {
  const certs = pickAll(params, 'gst', 'iso', 'msme', 'pf', 'esic', 'labour license', 'psara', 'certification')
    .filter((p) => p.value?.trim())
    .map((p) => `${p.parameter}: ${p.value}`);

  return {
    turnoverRequirement: pick(params, 'turnover', 'annual turnover'),
    experienceRequirement: pick(params, 'experience', 'similar work', 'past experience'),
    netWorthRequirement: pick(params, 'net worth'),
    bidCapacity: pick(params, 'bid capacity', 'capacity'),
    bankSolvency: pick(params, 'bank solvency', 'solvency'),
    mandatoryCertifications: certs.slice(0, 8),
  };
}

function buildFinancial(params: EnterpriseMasterDatasetEntry[]): FinancialSummarySection {
  const tenderValue = pick(params, 'tender value', 'estimated value', 'contract value');
  const emd = pick(params, 'emd', 'earnest money');
  const fee = pick(params, 'tender fee', 'document fee');
  const pbg = pick(params, 'performance security', 'performance bank guarantee', 'pbg');
  const bg = pick(params, 'bank guarantee', 'bid security', 'bg');

  const exposure =
    parseAmount(tenderValue) * 0.05 +
    parseAmount(emd) +
    parseAmount(fee) +
    parseAmount(pbg || bg);

  return {
    tenderValue,
    emd,
    tenderFee: fee,
    performanceSecurity: pbg,
    bankGuarantee: bg,
    estimatedFinancialExposure: exposure > 0 ? `₹${Math.round(exposure).toLocaleString('en-IN')}` : '—',
  };
}

function parseDaysRemaining(dateStr: string): number | null {
  if (!dateStr?.trim()) return null;
  const iso = dateStr.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const dmy = dateStr.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  let y = 0,
    m = 0,
    d = 0;
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
    if (y < 100) y += 2000;
  } else return null;
  const target = new Date(y, m - 1, d);
  return Math.ceil((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function buildTimeline(params: EnterpriseMasterDatasetEntry[]): TimelineSummarySection {
  const bidEnd = pick(params, 'bid end', 'bid submission', 'last date', 'closing date');
  return {
    publishingDate: pick(params, 'publishing', 'publish date', 'nit date'),
    preBidMeeting: pick(params, 'pre bid', 'pre-bid'),
    bidStartDate: pick(params, 'bid start', 'start date'),
    bidEndDate: bidEnd,
    technicalOpening: pick(params, 'technical opening', 'technical bid opening'),
    financialOpening: pick(params, 'financial opening', 'financial bid opening'),
    completionPeriod: pick(params, 'completion period', 'contract period'),
    daysRemaining: parseDaysRemaining(bidEnd),
  };
}

function buildChecklistReadiness(checklist: DynamicChecklistResult): ChecklistReadinessSection {
  const s = checklist.summary;
  const criticalMissing = checklist.categories
    .flatMap((c) => c.items)
    .filter((i) => i.critical && i.missing)
    .map((i) => i.name);

  return {
    requiredDocuments: s.required,
    uploadedDocuments: s.uploaded + s.approved,
    missingDocuments: s.missing,
    expiredDocuments: s.expired,
    readinessScore: s.readinessScore,
    readinessLabel: s.readinessLabel,
    criticalMissing,
  };
}

function buildExperienceMatching(
  params: EnterpriseMasterDatasetEntry[],
  checklist: DynamicChecklistResult
): ExperienceMatchingSection {
  const expReq = pick(params, 'experience', 'similar work', 'past experience');
  const turnoverReq = pick(params, 'turnover');

  const experienceItems = checklist.categories
    .filter((c) => c.id === 'technical_documents' || c.id === 'experience_documents')
    .flatMap((c) => c.items)
    .filter((i) => i.itemType !== 'experience_header');

  const uploadedExp = experienceItems.filter((i) => i.uploaded || i.status === 'approved');
  const missingExp = experienceItems.filter((i) => i.required && i.missing);

  const rows: ExperienceMatchingSection['rows'] = [];
  if (expReq) {
    rows.push({
      requirement: `Experience: ${expReq}`,
      status: missingExp.length ? 'gap' : uploadedExp.length ? 'matched' : 'partial',
      note: missingExp.length ? 'Experience documents missing' : 'Experience evidence available',
    });
  }
  if (turnoverReq) {
    rows.push({
      requirement: `Turnover: ${turnoverReq}`,
      status: checklist.categories
        .flatMap((c) => c.items)
        .some((i) => /turnover/i.test(i.name) && i.uploaded)
        ? 'matched'
        : 'partial',
      note: 'Based on turnover certificate checklist status',
    });
  }

  let eligibilityStatus: ExperienceMatchingSection['eligibilityStatus'] = 'Likely Eligible';
  if (missingExp.length >= 2) eligibilityStatus = 'Not Eligible';
  else if (missingExp.length === 1) eligibilityStatus = 'Partially Eligible';

  return {
    matchingProjects: uploadedExp.map((i) => i.matchedFileName || i.name).filter(Boolean),
    experienceGaps: missingExp.map((i) => i.name),
    eligibilityStatus,
    rows,
  };
}

function mapRiskLevel(level: string): 'Low' | 'Medium' | 'High' {
  if (level === 'HIGH') return 'High';
  if (level === 'MEDIUM') return 'Medium';
  return 'Low';
}

function buildRisk(risk: TenderRiskAnalysisResult): RiskAnalysisSection {
  const risks: RiskAnalysisSection['risks'] = risk.risks.map((r) => ({
    riskType: r.riskType,
    level: mapRiskLevel(r.level),
    reason: r.reason,
    confidence: r.confidence,
  }));

  const technical = risk.risks.find((r) => r.riskType === 'Technical Risk');
  if (technical) {
    risks.push({
      riskType: 'Operational Risk',
      level: mapRiskLevel(technical.level),
      reason: technical.reason,
      confidence: technical.confidence,
    });
  }

  return {
    overallLevel: mapRiskLevel(risk.overallLevel),
    risks,
  };
}

function buildRecommendation(
  checklist: ChecklistReadinessSection,
  risk: RiskAnalysisSection,
  experience: ExperienceMatchingSection
): AiRecommendationSection {
  const readiness = checklist.readinessScore;
  const criticalMissing = checklist.criticalMissing.length;
  const highRisks = risk.risks.filter((r) => r.level === 'High').length;

  let recommendation: EnterpriseFeasibilityRecommendation = 'Recommended';
  const benefits: string[] = [];
  const risksList: string[] = [];
  const requiredActions: string[] = [];

  if (readiness >= 90 && risk.overallLevel === 'Low' && criticalMissing === 0) {
    recommendation = 'Strongly Recommended';
    benefits.push('High checklist readiness', 'Low overall risk profile');
  } else if (readiness >= 75 && risk.overallLevel !== 'High') {
    recommendation = 'Recommended';
    benefits.push('Acceptable readiness for bid preparation');
  } else if (readiness >= 55 || criticalMissing <= 2) {
    recommendation = 'Recommended With Conditions';
    requiredActions.push('Complete missing critical documents before submission');
  } else if (highRisks >= 2 || criticalMissing >= 3) {
    recommendation = 'High Risk';
    risksList.push('Multiple high-risk factors identified');
  } else {
    recommendation = 'Not Recommended';
    risksList.push('Insufficient readiness and eligibility alignment');
  }

  if (checklist.missingDocuments > 0) {
    requiredActions.push(`Upload ${checklist.missingDocuments} missing required documents`);
  }
  if (experience.experienceGaps.length) {
    requiredActions.push(`Address experience gaps: ${experience.experienceGaps.join(', ')}`);
  }
  if (checklist.expiredDocuments > 0) {
    requiredActions.push('Renew expired certificates');
  }

  for (const r of risk.risks.filter((x) => x.level === 'High')) {
    risksList.push(`${r.riskType}: ${r.reason}`);
  }

  const reason = `${recommendation} based on ${readiness}% checklist readiness, ${risk.overallLevel} overall risk, and ${experience.eligibilityStatus} status.`;

  return {
    recommendation,
    reason,
    benefits: benefits.length ? benefits : ['Tender parameters validated via master dataset'],
    risks: risksList.length ? risksList : ['Standard bid execution risks apply'],
    requiredActions: requiredActions.length ? requiredActions : ['Proceed with standard bid preparation'],
  };
}

export function buildEnterpriseFeasibilityReport(opts: {
  tenderId: string;
  documentId: string;
  serviceCategory: string;
  masterParameters: EnterpriseMasterDatasetEntry[];
  checklist: DynamicChecklistResult;
  risk: TenderRiskAnalysisResult;
  generatedBy?: string;
}): EnterpriseFeasibilityReport {
  const overview = buildOverview(opts.masterParameters, opts.serviceCategory);
  const scopeSummary = buildScope(opts.masterParameters);
  const manpowerRequirements = buildManpower(opts.masterParameters);
  const eligibilitySummary = buildEligibility(opts.masterParameters);
  const financialSummary = buildFinancial(opts.masterParameters);
  const timelineSummary = buildTimeline(opts.masterParameters);
  const checklistReadiness = buildChecklistReadiness(opts.checklist);
  const experienceMatching = buildExperienceMatching(opts.masterParameters, opts.checklist);
  const riskAnalysis = buildRisk(opts.risk);
  const aiRecommendation = buildRecommendation(checklistReadiness, riskAnalysis, experienceMatching);

  return {
    tenderId: opts.tenderId,
    documentId: opts.documentId,
    schemaVersion: ENTERPRISE_FEASIBILITY_SCHEMA_VERSION,
    dataSource: 'enterprise_master_dataset',
    generatedAt: new Date().toISOString(),
    generatedBy: opts.generatedBy,
    approvalStatus: 'draft',
    decisionHistory: [],
    overview,
    scopeSummary,
    manpowerRequirements,
    eligibilitySummary,
    financialSummary,
    timelineSummary,
    checklistReadiness,
    experienceMatching,
    riskAnalysis,
    aiRecommendation,
    financeWorkflow: {
      emdStatus: 'Not Requested',
      bgStatus: 'Not Requested',
      tenderFeeStatus: 'Not Requested',
    },
    complianceWorkflow: {
      packageGenerated: false,
      approvalStatus: 'Not Started',
      missingDocuments: checklistReadiness.criticalMissing,
    },
  };
}
