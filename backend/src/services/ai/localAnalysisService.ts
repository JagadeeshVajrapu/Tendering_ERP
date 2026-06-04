import { ITenderAnalysisData, IImportantDate } from '../../models/TenderAnalysis';
import { IExtractedNitData, IRiskAssessment } from '../../models/NitAnalysis';
import { RiskLevel } from '../../types';
import { FeasibilityReportContent } from '../report/pdfService';

function extractPattern(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ');
  }
  return '';
}

function extractAmount(text: string, labels: string[]): string {
  for (const label of labels) {
    const patterns = [
      new RegExp(`${label}[^\\d₹]{0,40}((?:Rs\\.?|INR|₹)?\\s*[\\d,]+(?:\\.\\d+)?\\s*(?:Cr|Crore|crores|Lakh|Lac|lakhs)?)`, 'i'),
      new RegExp(`${label}\\s*[:\\-]\\s*((?:Rs\\.?|INR|₹)?\\s*[\\d,]+(?:\\.\\d+)?\\s*(?:Cr|Crore|Lakh|Lac)?)`, 'i'),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]) return m[1].trim();
    }
  }
  return '';
}

function extractYesNo(text: string, keywords: string[]): string {
  for (const kw of keywords) {
    const re = new RegExp(`${kw}[^\\n]{0,60}?\\b(yes|no|required|not required|applicable|not applicable)\\b`, 'i');
    const m = text.match(re);
    if (m?.[1]) {
      const v = m[1].toLowerCase();
      if (v === 'yes' || v === 'required' || v === 'applicable') return 'Yes';
      if (v === 'no' || v === 'not required' || v === 'not applicable') return 'No';
    }
    if (new RegExp(`${kw}[^\\n]{0,20}(?:is\\s+)?mandatory`, 'i').test(text)) return 'Yes';
  }
  return '';
}

function extractBgRequirement(text: string): string {
  const amount = extractAmount(text, [
    'performance bank guarantee',
    'performance guarantee',
    'bank guarantee',
    'security deposit',
    'PBG',
  ]);
  if (amount) return amount;

  const m = text.match(
    /(?:bank guarantee|performance guarantee|bg|PBG)\s*(?:required|amount|of)?[^:\n]{0,30}[:\s]+([^\n]{3,100})/i
  );
  if (m?.[1]) return m[1].trim();
  if (/\bbank guarantee\b|\bperformance guarantee\b|\bPBG\b/i.test(text)) return 'Yes';
  return '';
}

function extractListItems(text: string, sectionKeywords: string[]): string[] {
  const items: string[] = [];
  const lower = text.toLowerCase();
  for (const kw of sectionKeywords) {
    const idx = lower.indexOf(kw);
    if (idx === -1) continue;
    const slice = text.slice(idx, idx + 1200);
    const lines = slice
      .split(/\n|(?:\d+\.)|(?:\([a-z]\))|(?:•)|(?:-)/)
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter((l) => l.length >= 4 && l.length < 180 && !/^page\s+\d/i.test(l));
    items.push(...lines.slice(0, 6));
  }
  return items;
}

function extractEligibilityKeywords(text: string): string[] {
  const found: string[] = [];
  const rules: [RegExp, string][] = [
    [/\b(?:minimum\s+)?(?:annual\s+)?turnover[^.\n]{0,80}/i, 'Turnover requirement'],
    [/\bOEM\b|\boriginal equipment manufacturer\b/i, 'OEM'],
    [/\bsimilar (?:work|experience)[^.\n]{0,80}/i, 'Similar work experience'],
    [/\b(?:past|prior) experience[^.\n]{0,80}/i, 'Experience'],
    [/\bMSME\b|\bMSE\b|\bUdyam\b/i, 'MSME'],
    [/\b(?:class\s+[A-Z]|contractor class)[^.\n]{0,40}/i, 'Contractor class'],
    [/\b(?:net worth|paid[- ]up capital)[^.\n]{0,60}/i, 'Financial eligibility'],
    [/\b(?:ISO\s*9001|ISO\s*14001|ISO certification)/i, 'ISO certification'],
    [/\b(?:GST|GSTIN)\b[^.\n]{0,40}/i, 'GST registration'],
    [/\b(?:PAN|permanent account number)\b/i, 'PAN'],
    [/\b(?:registration|empanelment)[^.\n]{0,50}/i, 'Registration/Empanelment'],
  ];
  for (const [re, label] of rules) {
    const m = text.match(re);
    if (m) found.push(m[0].length <= 80 ? m[0].trim() : label);
  }
  return found;
}

function extractTechnicalKeywords(text: string): string[] {
  const tags: string[] = [];
  const patterns: [RegExp, string][] = [
    [/\bISO\s*9001?\b/i, 'ISO 9001'],
    [/\bISO\s*14001\b/i, 'ISO 14001'],
    [/\bMSME\b/i, 'MSME'],
    [/\bGST\b|\bGSTIN\b/i, 'GST'],
    [/\bBIS\b/i, 'BIS'],
    [/\bCE\b/i, 'CE'],
    [/\bRoHS\b/i, 'RoHS'],
    [/\bMake in India\b/i, 'Make in India'],
    [/\bOEM\b/i, 'OEM'],
    [/\bIS\s+\d+/i, 'IS standards'],
  ];
  for (const [re, label] of patterns) {
    if (re.test(text) && !tags.includes(label)) tags.push(label);
  }
  const listItems = extractListItems(text, [
    'technical requirement',
    'technical specification',
    'technical bid',
    'qualification requirement',
    'special conditions',
  ]);
  return [...tags, ...listItems];
}

function extractImportantDates(text: string): IImportantDate[] {
  const dates: IImportantDate[] = [];
  const patterns: [RegExp, string][] = [
    [/bid submission[^:\n]{0,30}[:\s]+([^\n]{4,50})/gi, 'Bid Submission'],
    [/(?:last date|closing date)[^:\n]{0,30}[:\s]+([^\n]{4,50})/gi, 'Last Date'],
    [/pre[- ]?bid meeting[^:\n]{0,30}[:\s]+([^\n]{4,50})/gi, 'Pre-Bid Meeting'],
    [/bid opening[^:\n]{0,30}[:\s]+([^\n]{4,50})/gi, 'Bid Opening'],
    [/technical bid[^:\n]{0,30}[:\s]+([^\n]{4,50})/gi, 'Technical Bid Opening'],
    [/financial bid[^:\n]{0,30}[:\s]+([^\n]{4,50})/gi, 'Financial Bid Opening'],
  ];
  for (const [re, label] of patterns) {
    const matches = [...text.matchAll(re)];
    for (const m of matches.slice(0, 2)) {
      if (m[1]) dates.push({ label, date: m[1].trim() });
    }
  }
  return dates;
}

function extractOrganization(text: string): string {
  const fromLabel = extractPattern(text, [
    /(?:tender(?:ing)? authority|issuing authority|name of (?:work|department|organisation|organization))[:\s]+([^\n]{3,100})/i,
    /(?:organization|organisation|authority|department|issued by|invited by)[:\s]+([^\n]{3,100})/i,
  ]);
  if (fromLabel) return fromLabel;

  const knownAuthorities = [
    'CPWD', 'NPCIL', 'NTPC', 'BHEL', 'Indian Railways', 'DRDO', 'ISRO',
    'Municipal Corporation', 'Public Works Department', 'GeM', 'GEM Portal',
  ];
  for (const auth of knownAuthorities) {
    if (new RegExp(`\\b${auth.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) return auth;
  }
  return '';
}

function extractScopeOfWork(text: string): string {
  const fromLabel = extractPattern(text, [
    /(?:scope of work|work scope|nature of work|description of work|work to be done)[:\s]+([^\n]{15,300})/i,
    /(?:tender for|supply of|work of)[:\s]+([^\n]{15,200})/i,
  ]);
  if (fromLabel) return fromLabel;
  return '';
}

export function buildLocalTenderAnalysis(rawText: string): ITenderAnalysisData {
  const text = rawText.slice(0, 80000);

  const tenderNumber = extractPattern(text, [
    /tender\s*(?:no|number|id|ref)[.:\s]*([A-Z0-9/\-]+)/i,
    /nit\s*(?:no|number)[.:\s]*([A-Z0-9/\-]+)/i,
    /e-?tender\s*(?:no|id)[.:\s]*([A-Z0-9/\-]+)/i,
    /ref(?:erence)?[.:\s]*([A-Z0-9/\-]+)/i,
  ]);

  const estimatedValue = extractAmount(text, [
    'estimated contract value',
    'estimated value',
    'tender value',
    'contract value',
    'approximate value',
    'cost of work',
    'value of work',
  ]);
  const emdAmount = extractAmount(text, [
    'emd amount',
    'emd',
    'earnest money deposit',
    'earnest money',
    'bid security',
    'tender fee',
  ]);
  const bgRequirement = extractBgRequirement(text);
  const reverseAuction =
    extractYesNo(text, ['reverse auction', 'e-reverse auction', 'e-auction', 'online auction']) || 'No';
  const mafRequired =
    extractYesNo(text, [
      'maf',
      'manufacturer authorization',
      'manufacturer authorisation',
      'authorization form',
      'authorisation form',
    ]) || 'No';

  const organization = extractOrganization(text);
  const importantDates = extractImportantDates(text);
  const eligibilityFromList = extractListItems(text, [
    'eligibility',
    'qualification criteria',
    'pre-qualification',
    'prequalification',
  ]);
  const eligibilityKeywords = extractEligibilityKeywords(text);
  const eligibilityCriteria = [...eligibilityKeywords, ...eligibilityFromList];

  const technicalRequirements = extractTechnicalKeywords(text);
  const scopeOfWork = extractScopeOfWork(text);

  const bidSubmissionDate =
    extractPattern(text, [
      /(?:submission date|bid submission|last date(?: for| of)? submission|due date)[^:\n]*[:\s]+([^\n]{4,50})/i,
      /last date[^:\n]*[:\s]+([^\n]{4,50})/i,
    ]) ||
    importantDates.find((d) => /submission|last date/i.test(d.label))?.date ||
    '';

  return {
    tenderName:
      extractPattern(text, [
        /(?:name of work|tender title|tender for|title of work)[:\s]+([^\n]{5,150})/i,
        /tender\s*(?:for|title)[:\s]+([^\n]{5,150})/i,
      ]) ||
      tenderNumber ||
      'Tender Opportunity',
    department: extractPattern(text, [/department[:\s]+([^\n]{3,80})/i]) || '',
    organization,
    tenderNumber: tenderNumber || '',
    estimatedValue,
    emdAmount,
    bgRequirement,
    bidSubmissionDate,
    preBidMeetingDate:
      extractPattern(text, [/pre[- ]?bid(?: meeting)?[^:\n]*[:\s]+([^\n]{4,50})/i]) ||
      importantDates.find((d) => /pre-bid/i.test(d.label))?.date ||
      '',
    contractDuration: extractPattern(text, [
      /(?:completion time|time for completion|contract period|contract duration|period of completion)[^:\n]*[:\s]+([^\n]{4,80})/i,
      /(?:within|in)\s+(\d+\s*(?:days|months|weeks)(?:\s+from[^.\n]{0,30})?)/i,
      /completion[^:\n]*[:\s]+([^\n]{4,60})/i,
    ]),
    scopeOfWork,
    eligibilityCriteria,
    technicalRequirements,
    reverseAuction,
    mafRequired,
    requiredDocuments: extractListItems(text, [
      'required documents',
      'documents to be submitted',
      'documents required',
      'bid documents',
      'enclosures',
    ]),
    importantDates,
    paymentTerms: extractPattern(text, [
      /payment terms[^:\n]*[:\s]+([^\n]{10,200})/i,
      /(?:mode of payment|payment schedule)[^:\n]*[:\s]+([^\n]{10,200})/i,
    ]),
    riskFactors: [
      'Verify submission deadline and document completeness',
      'Confirm EMD and financial eligibility before bidding',
      'Review penalty and liability clauses in full document',
    ],
    aiRecommendation:
      'Review Required — Verify extracted fields against the full tender document before submission.',
  };
}

export function buildLocalFeasibilityContent(analysis: ITenderAnalysisData): FeasibilityReportContent {
  const suitable = !analysis.aiRecommendation.toLowerCase().includes('not suitable');
  return {
    scopeSummary: analysis.scopeOfWork.slice(0, 300) || 'Scope as per tender document.',
    eligibilitySummary:
      (analysis.eligibilityCriteria.slice(0, 4).join('. ') || 'Eligibility as per tender document.') + '.',
    timelineSummary: `Bid submission: ${analysis.bidSubmissionDate || 'See tender document'}. Duration: ${analysis.contractDuration || 'See tender document'}.`,
    financialSummary: `Value: ${analysis.estimatedValue || 'N/A'}. EMD: ${analysis.emdAmount || 'N/A'}. ${analysis.paymentTerms || ''}`,
    keyRisks: analysis.riskFactors.slice(0, 5),
    recommendation: suitable ? 'Suitable' : 'Not Suitable',
  };
}

export function buildLocalNitExtraction(rawText: string): IExtractedNitData {
  const analysis = buildLocalTenderAnalysis(rawText);
  const num = (s: string) => parseFloat(s.replace(/[^\d.]/g, '')) || 0;

  return {
    tenderAuthority: analysis.organization,
    tenderNumber: analysis.tenderNumber,
    tenderValue: num(analysis.estimatedValue),
    emdAmount: num(analysis.emdAmount),
    scopeOfWork: analysis.scopeOfWork,
    eligibilityCriteria: analysis.eligibilityCriteria,
    requiredDocuments: analysis.requiredDocuments,
    importantDates: analysis.importantDates,
    bgRequirement: analysis.bgRequirement,
    completionTime: analysis.contractDuration,
    experienceRequirement: 'As per tender document',
    turnoverRequirement: 'As per tender document',
    gstRequirement: 'Valid GST required',
    panRequirement: 'Valid PAN required',
    technicalRequirements: analysis.technicalRequirements,
    submissionDate: analysis.bidSubmissionDate,
    bidOpeningDate: analysis.importantDates.find((d) => /opening/i.test(d.label))?.date || '',
    reverseAuction: analysis.reverseAuction.toLowerCase() === 'yes',
  };
}

export function buildLocalRiskAssessment(): IRiskAssessment {
  return {
    riskSummary: 'Local analysis — review document manually for full risk assessment.',
    disqualificationPoints: ['Incomplete submission', 'Missing EMD'],
    missingDocuments: [],
    criticalClauses: ['Refer to penalty and termination clauses in tender document'],
    deadlineRisks: ['Confirm submission deadline'],
    financialRisks: ['Verify EMD and BG requirements'],
    riskLevel: RiskLevel.MEDIUM,
  };
}
