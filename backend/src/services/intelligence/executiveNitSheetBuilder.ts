import {
  ExecutiveNitPresentation,
  FeasibilityRecommendation,
  MdReport,
  NitAnalysisSheet,
  NitRiskItem,
  NitSheetRow,
  NitSheetSection,
} from '../../types/intelligence';
import { ExtractedProductionField } from './extractedProductionField';
import { VerifiedNitJson } from './verifiedNitJsonBuilder';
import {
  combineCorpus,
  formatExecutiveDuration,
  formatYesNoFromText,
  getVerifiedFieldValue,
  isDisplayableExecutiveValue,
} from './executiveDisplayFormatter';

export type { ExecutiveNitPresentation };

type RowSpec = { parameter: string; fieldIds: string[] };

const VERIFIED_ROW_KEYS: Record<string, keyof VerifiedNitJson> = {
  'Tender Name': 'tenderName',
  'Tender Number': 'tenderNumber',
  'Tender Authority': 'tenderAuthority',
  'Tender Value': 'estimatedTenderValue',
  'EMD Amount': 'emdAmount',
  'Tender Fee': 'tenderFee',
  'Performance Security': 'performanceSecurity',
  'Bank Guarantee': 'bankGuarantee',
  'Bid Security': 'bidSecurityAmount',
  'Submission Mode': 'submissionMode',
  'Bid System': 'bidSystem',
  'Submission End Date': 'bidSubmissionDate',
  'Pre-Bid Date': 'preBidMeetingDate',
  'Contract Duration': 'contractDuration',
  'Completion Time': 'contractDuration',
  'Work Location': 'workLocation',
  'Experience Requirement': 'experienceRequirement',
  'Turnover Requirement': 'turnoverRequirement',
  'GST Requirement': 'gstRequirement',
  'EPF Requirement': 'epfRequirement',
  'ESI Requirement': 'esiRequirement',
  'Labour License Requirement': 'labourLicense',
  'MAF Required': 'mafRequired',
  'Reverse Auction': 'reverseAuction',
};

function pick(fields: ExtractedProductionField[], ids: string[]): string | null {
  return getVerifiedFieldValue(fields, ids)?.value ?? null;
}

function pickFromVerified(verifiedNit: VerifiedNitJson | undefined, parameter: string): string | null {
  const key = VERIFIED_ROW_KEYS[parameter];
  if (!key || !verifiedNit) return null;
  const v = verifiedNit[key];
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v[0] || null;
  const s = String(v).trim();
  if (!s || !isDisplayableExecutiveValue(s, key)) return null;
  return s;
}

function buildSectionRows(
  fields: ExtractedProductionField[],
  specs: RowSpec[],
  verifiedNit?: VerifiedNitJson,
  skipDupValues = true
): NitSheetRow[] {
  const rows: NitSheetRow[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    if (seen.has(spec.parameter)) continue;
    const value = pickFromVerified(verifiedNit, spec.parameter) ?? pick(fields, spec.fieldIds);
    if (!value) continue;

    if (skipDupValues) {
      const dup = rows.find((r) => r.value === value && r.parameter !== spec.parameter);
      if (dup) {
        const similar =
          (spec.parameter === 'Contract Duration' && dup.parameter === 'Completion Time') ||
          (spec.parameter === 'Estimated Cost' && dup.parameter === 'Tender Value') ||
          (spec.parameter === 'Security Deposit' && dup.parameter === 'Performance Security');
        if (similar) continue;
      }
    }

    if (spec.parameter === 'Organization') {
      const auth = rows.find((r) => r.parameter === 'Tender Authority');
      if (auth && auth.value.trim().toLowerCase() === value.trim().toLowerCase()) continue;
    }

    seen.add(spec.parameter);
    rows.push({ parameter: spec.parameter, value });
  }
  return rows;
}

function pickListField(fields: ExtractedProductionField[], id: string, max = 15): string[] {
  const f = fields.find((x) => x.id === id && x.validated && x.value);
  if (!f?.value) return [];
  const items = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
  return items
    .map((i) => i.replace(/\s+/g, ' ').trim())
    .filter((i) => isDisplayableExecutiveValue(i, id))
    .map((i) => (i.length > 80 ? `${i.slice(0, 77)}…` : i))
    .slice(0, max);
}

function formatTechnicalItems(fields: ExtractedProductionField[]): string[] {
  const items = pickListField(fields, 'technicalRequirements', 20);
  if (items.length) return [...new Set(items)];

  const tech = fields.filter(
    (f) => f.section === 'technical' && f.validated && f.value && f.id !== 'technicalRequirements'
  );
  for (const f of tech) {
    const v = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
    items.push(...v);
  }

  return [...new Set(items.map((i) => i.trim()).filter(Boolean))].slice(0, 15);
}

function formatScopeBullets(fields: ExtractedProductionField[], md?: MdReport): string[] {
  const raw =
    pick(fields, ['scopeOfWork']) ||
    (md?.scopeSummary && isDisplayableExecutiveValue(md.scopeSummary, 'scopeOfWork')
      ? md.scopeSummary
      : null);
  if (!raw) return [];

  const sentences = raw
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && isDisplayableExecutiveValue(s, 'scopeOfWork'));

  const lines = sentences.length ? sentences : [raw.slice(0, 200)];
  return lines.slice(0, 5).map((l) => (l.length > 160 ? `${l.slice(0, 157)}…` : l));
}

function formatDocumentList(fields: ExtractedProductionField[]): string[] {
  const fromField = pickListField(fields, 'requiredDocuments', 25);
  const found = new Set<string>(fromField);

  const corpus = combineCorpus(fields);
  const patterns: [RegExp, string][] = [
    [/\bgst\s*(?:certificate|registration)/i, 'GST Certificate'],
    [/\bpan\s*(?:card|copy)/i, 'PAN Card'],
    [/\bepf\s*(?:registration|code)/i, 'EPF Registration'],
    [/\besi\s*(?:registration|code)/i, 'ESI Registration'],
    [/audited\s+(?:financial|balance)/i, 'Audited Balance Sheet'],
    [/labou?r\s+license/i, 'Labour License'],
    [/experience\s+cert/i, 'Experience Certificates'],
    [/iso\s*9001/i, 'ISO 9001 Certificate'],
    [/power\s+of\s+attorney/i, 'Power of Attorney'],
    [/affidavit/i, 'Affidavit'],
    [/earnest\s+money/i, 'EMD / Bid Security Proof'],
    [/tender\s+fee/i, 'Tender Fee Receipt'],
    [/signed\s+bid/i, 'Signed Bid Document'],
    [/bank\s+solvency/i, 'Bank Solvency Certificate'],
    [/chartered\s+accountant/i, 'CA Certificate'],
    [/udyam|msme/i, 'MSME / Udyam Certificate'],
    [/oem|manufacturer\s+authorization/i, 'OEM / MAF Authorization'],
  ];

  for (const [re, label] of patterns) {
    if (re.test(corpus)) found.add(label);
  }

  return [...found].slice(0, 20);
}

function corpusYesNo(corpus: string, keyword: RegExp, notPattern?: RegExp): string | null {
  if (notPattern?.test(corpus)) return 'No';
  if (keyword.test(corpus)) return 'Yes';
  return null;
}

function resolveGeneralExtras(
  fields: ExtractedProductionField[],
  corpus: string,
  rows: NitSheetRow[]
): NitSheetRow[] {
  const extra: NitSheetRow[] = [];

  if (!rows.some((r) => r.parameter === 'Reverse Auction')) {
    const ra = pick(fields, ['reverseAuction']) || formatYesNoFromText(corpus);
    if (ra) extra.push({ parameter: 'Reverse Auction', value: ra });
  }

  if (!rows.some((r) => r.parameter === 'MAF Required')) {
    const maf =
      pick(fields, ['mafRequired']) ||
      corpusYesNo(corpus, /maf|manufacturer\s+authorization/i, /no\s+maf|maf\s+not\s+required/i);
    if (maf) extra.push({ parameter: 'MAF Required', value: maf });
  }

  if (!rows.some((r) => r.parameter === 'Bid System')) {
    const bid = pick(fields, ['bidSystem']);
    if (bid) extra.push({ parameter: 'Bid System', value: bid });
    else if (/two\s+(?:bid|envelope)/i.test(corpus)) {
      extra.push({ parameter: 'Bid System', value: 'Two Bid System' });
    } else if (/single\s+stage/i.test(corpus)) {
      extra.push({ parameter: 'Bid System', value: 'Single Stage' });
    }
  }

  return extra;
}

function buildComplianceRows(fields: ExtractedProductionField[]): NitSheetRow[] {
  const rows: NitSheetRow[] = [];

  const statutory = pickListField(fields, 'statutoryRequirements', 6);
  const statutoryText = statutory.length
    ? statutory.join(', ')
    : pick(fields, ['gstRequirement', 'epfRequirement', 'esiRequirement']);
  if (statutoryText) rows.push({ parameter: 'Statutory Requirements', value: statutoryText });

  const contractual = pickListField(fields, 'contractualRequirements', 6);
  const contractualText = contractual.length
    ? contractual.join(', ')
    : pick(fields, ['complianceRequirements']);
  if (contractualText && contractualText.length <= 120) {
    rows.push({ parameter: 'Contractual Requirements', value: contractualText });
  }

  const legal = pickListField(fields, 'legalRequirements', 6);
  if (legal.length) {
    rows.push({ parameter: 'Legal Requirements', value: legal.join(', ') });
  } else if (/applicable\s+law|legal\s+compliance/i.test(combineCorpus(fields))) {
    rows.push({ parameter: 'Legal Requirements', value: 'As per applicable laws & tender conditions' });
  }

  return rows;
}

function buildRiskItems(
  fields: ExtractedProductionField[],
  recommendation: FeasibilityRecommendation
): NitRiskItem[] {
  const items: NitRiskItem[] = [];
  const corpus = combineCorpus(fields);

  const finMissing = !pick(fields, ['emdAmount', 'estimatedTenderValue']);
  const finRisk =
    /liquidated\s+damages|penalty|forfeit/i.test(corpus) || pick(fields, ['risks']);
  items.push({
    category: 'Financial Risk',
    level: finMissing ? 'High' : finRisk ? 'Medium' : 'Low',
    note: finMissing
      ? 'Key commercial values not verified in document'
      : finRisk
        ? 'Penalties / LD clauses present — review financial exposure'
        : 'No major financial red flags from verified data',
  });

  const techCount = formatTechnicalItems(fields).length;
  items.push({
    category: 'Technical Risk',
    level: techCount === 0 ? 'Medium' : techCount > 10 ? 'Medium' : 'Low',
    note:
      techCount === 0
        ? 'Technical requirements not fully captured — verify specifications'
        : `${techCount} technical requirement(s) identified`,
  });

  const eligMissing =
    !pick(fields, ['experienceRequirements']) && !pick(fields, ['turnoverRequirements']);
  items.push({
    category: 'Eligibility Risk',
    level: eligMissing ? 'High' : 'Low',
    note: eligMissing
      ? 'Experience / turnover criteria not verified'
      : 'Core eligibility parameters present in analysis',
  });

  const timeMissing = !pick(fields, ['bidSubmissionDate', 'contractDuration']);
  items.push({
    category: 'Timeline Risk',
    level: timeMissing ? 'High' : /short\s+period|tight\s+schedule/i.test(corpus) ? 'Medium' : 'Low',
    note: timeMissing
      ? 'Critical dates / completion period missing'
      : 'Timeline parameters captured from document',
  });

  if (recommendation === 'Do Not Apply') {
    for (const it of items) {
      if (it.level === 'Low') it.level = 'Medium';
    }
  }

  return items;
}

const SECTION_SPECS: { id: string; title: string; specs: RowSpec[] }[] = [
  {
    id: 'general',
    title: 'General Information',
    specs: [
      { parameter: 'Tender Name', fieldIds: ['tenderName'] },
      { parameter: 'Tender Number', fieldIds: ['tenderNumber', 'tenderReferenceNumber'] },
      { parameter: 'Tender Authority', fieldIds: ['issuingAuthority', 'organization'] },
      { parameter: 'Department', fieldIds: ['department'] },
      { parameter: 'Organization', fieldIds: ['organization'] },
      { parameter: 'Tender Category', fieldIds: ['tenderCategory', 'serviceCategory'] },
      { parameter: 'Tender Type', fieldIds: ['tenderType'] },
      { parameter: 'Work Location', fieldIds: ['workLocation'] },
      { parameter: 'Submission Mode', fieldIds: ['submissionMode'] },
      { parameter: 'Bid System', fieldIds: ['bidSystem'] },
      { parameter: 'Reverse Auction', fieldIds: ['reverseAuction'] },
      { parameter: 'MAF Required', fieldIds: ['mafRequired'] },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Information',
    specs: [
      { parameter: 'Tender Value', fieldIds: ['estimatedTenderValue'] },
      { parameter: 'Estimated Cost', fieldIds: ['estimatedCost', 'estimatedTenderValue'] },
      { parameter: 'EMD Amount', fieldIds: ['emdAmount'] },
      { parameter: 'Tender Fee', fieldIds: ['tenderFee'] },
      { parameter: 'Performance Security', fieldIds: ['performanceSecurity'] },
      { parameter: 'Security Deposit', fieldIds: ['securityDeposit', 'performanceSecurity'] },
      { parameter: 'Bank Guarantee', fieldIds: ['bankGuarantee'] },
      { parameter: 'Bid Security', fieldIds: ['bidSecurityAmount'] },
      { parameter: 'Payment Terms', fieldIds: ['paymentTerms'] },
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline Information',
    specs: [
      { parameter: 'Tender Publish Date', fieldIds: ['tenderPublishDate'] },
      { parameter: 'Pre-Bid Date', fieldIds: ['preBidMeetingDate'] },
      { parameter: 'Clarification End Date', fieldIds: ['clarificationEndDate'] },
      { parameter: 'Submission Start Date', fieldIds: ['bidSubmissionStartDate'] },
      { parameter: 'Submission End Date', fieldIds: ['bidSubmissionDate'] },
      { parameter: 'Technical Bid Opening', fieldIds: ['technicalBidOpeningDate', 'bidOpeningDate'] },
      { parameter: 'Financial Bid Opening', fieldIds: ['financialBidOpeningDate', 'bidOpeningDate'] },
      { parameter: 'Contract Start Date', fieldIds: ['contractStartDate'] },
      { parameter: 'Completion Time', fieldIds: ['contractDuration'] },
      { parameter: 'Contract Duration', fieldIds: ['contractDuration'] },
    ],
  },
  {
    id: 'eligibility',
    title: 'Eligibility Information',
    specs: [
      { parameter: 'Experience Requirement', fieldIds: ['experienceRequirements'] },
      { parameter: 'Turnover Requirement', fieldIds: ['turnoverRequirements'] },
      { parameter: 'Net Worth Requirement', fieldIds: ['netWorthRequirement'] },
      { parameter: 'GST Requirement', fieldIds: ['gstRequirement'] },
      { parameter: 'PAN Requirement', fieldIds: ['panRequirement'] },
      { parameter: 'EPF Requirement', fieldIds: ['epfRequirement'] },
      { parameter: 'ESI Requirement', fieldIds: ['esiRequirement'] },
      { parameter: 'Labour License Requirement', fieldIds: ['labourLicense'] },
      { parameter: 'MSME Requirement', fieldIds: ['msmeRequirement'] },
      { parameter: 'Startup Requirement', fieldIds: ['startupRequirement'] },
      { parameter: 'OEM Requirement', fieldIds: ['oemRequirement'] },
      { parameter: 'ISO Requirement', fieldIds: ['certificationsRequired'] },
    ],
  },
];

function normalizeIsoRow(rows: NitSheetRow[], fields: ExtractedProductionField[]): NitSheetRow[] {
  const iso = rows.find((r) => r.parameter === 'ISO Requirement');
  if (!iso) return rows;
  const v = iso.value;
  if (!/iso/i.test(v)) {
    const cert = pick(fields, ['certificationsRequired']);
    if (cert && /iso/i.test(cert)) {
      iso.value = cert.includes('ISO') ? cert.slice(0, 100) : 'ISO Certification Required';
    } else {
      return rows.filter((r) => r.parameter !== 'ISO Requirement');
    }
  }
  return rows;
}

/** Build full enterprise NIT Analysis (10 sections). */
export function buildExecutiveNitPresentation(
  productionFields: ExtractedProductionField[],
  recommendation: FeasibilityRecommendation,
  mdReport?: MdReport,
  _legacySheet?: NitAnalysisSheet,
  verifiedNit?: VerifiedNitJson,
  riskItems?: NitRiskItem[]
): ExecutiveNitPresentation {
  const corpus = combineCorpus(productionFields);
  const sections: NitSheetSection[] = [];
  const allRows: NitSheetRow[] = [];

  for (const block of SECTION_SPECS) {
    let rows = buildSectionRows(productionFields, block.specs, verifiedNit);
    if (block.id === 'general') {
      rows = [...rows, ...resolveGeneralExtras(productionFields, corpus, rows)];
    }
    if (block.id === 'eligibility') {
      rows = normalizeIsoRow(rows, productionFields);
    }
    if (block.id === 'timeline') {
      rows = rows.map((r) => {
        if (r.parameter === 'Completion Time') {
          const d = formatExecutiveDuration(r.value);
          return d ? { ...r, value: d } : r;
        }
        return r;
      });
    }
    if (rows.length) {
      sections.push({ id: block.id, title: block.title, rows, variant: 'table' });
      allRows.push(...rows);
    }
  }

  const technicalItems = formatTechnicalItems(productionFields);
  if (technicalItems.length) {
    sections.push({
      id: 'technical',
      title: 'Technical Requirements',
      rows: technicalItems.map((item) => ({ parameter: item, value: 'Required' })),
      variant: 'technical',
      technicalItems,
    });
    allRows.push(...technicalItems.map((item) => ({ parameter: item, value: 'Required' })));
  }

  const scopeLines = formatScopeBullets(productionFields, mdReport);
  if (scopeLines.length) {
    sections.push({
      id: 'scope',
      title: 'Scope of Work',
      rows: [],
      variant: 'scope',
      scopeLines,
    });
  }

  const documentItems = formatDocumentList(productionFields);
  if (documentItems.length) {
    sections.push({
      id: 'documents',
      title: 'Required Documents',
      rows: [],
      variant: 'documents',
      documentItems,
    });
  }

  const complianceRows = buildComplianceRows(productionFields);
  if (complianceRows.length) {
    sections.push({
      id: 'compliance',
      title: 'Compliance Requirements',
      rows: complianceRows,
      variant: 'table',
    });
    allRows.push(...complianceRows);
  }

  const resolvedRiskItems =
    riskItems && riskItems.length
      ? riskItems
      : buildRiskItems(productionFields, recommendation);
  sections.push({
    id: 'risk',
    title: 'Risk Analysis',
    rows: [],
    variant: 'risk',
    riskItems: resolvedRiskItems,
  });

  sections.push({
    id: 'recommendation',
    title: 'Executive Recommendation',
    rows: [],
    variant: 'recommendation',
    recommendation,
  });

  return {
    rows: allRows,
    sections,
    recommendation,
    verifiedFieldCount: allRows.length,
  };
}
