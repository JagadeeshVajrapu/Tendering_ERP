import { IntelligenceFieldKey } from '../../types/intelligence';
import { ENTERPRISE_PRODUCTION_FIELDS } from './enterpriseProductionFields';

export type FieldSection =
  | 'general'
  | 'financial'
  | 'timeline'
  | 'eligibility'
  | 'documents'
  | 'technical'
  | 'compliance'
  | 'risk';

export type FieldValueType = 'text' | 'money' | 'date' | 'duration' | 'list';

export interface ProductionFieldDefinition {
  id: string;
  label: string;
  mergeKey: IntelligenceFieldKey;
  section: FieldSection;
  valueType: FieldValueType;
  labels: string[];
  /** Alternate labels searched in recovery / synonym pass. */
  synonymLabels?: string[];
  patterns: RegExp[];
  pageHints: string[];
  maxLength: number;
  listMaxItems?: number;
  /** Reject if value matches (wrong section bleed). */
  rejectIfContains?: RegExp[];
}

const MONEY = /(?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d+)?\s*(?:\/-)?(?:\s*(?:lakh|lac|crore|cr))?/i;
const DATE =
  /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}/i;

export const PRODUCTION_FIELDS: ProductionFieldDefinition[] = [
  {
    id: 'tenderName',
    label: 'Tender Name',
    mergeKey: 'tenderName',
    section: 'general',
    valueType: 'text',
    labels: ['name of work', 'name of tender', 'tender for', 'title of tender', 'subject'],
    patterns: [
      /(?:name of (?:work|tender)|tender for|title of tender)[:\s]+([^\n]{8,200})/i,
      /(?:invitation for|supply of|procurement of)[:\s]+([^\n]{8,200})/i,
    ],
    pageHints: ['nit', 'notice', 'invitation', 'tender'],
    maxLength: 300,
    rejectIfContains: [/the bidder shall/i, /hereinafter/i],
  },
  {
    id: 'tenderNumber',
    label: 'Tender Number',
    mergeKey: 'tenderNumber',
    section: 'general',
    valueType: 'text',
    labels: ['tender no', 'tender number', 'nit no', 'e-tender no', 'reference no'],
    patterns: [
      /tender\s*(?:no|number|id|ref)[.:\s]*([A-Z0-9][A-Z0-9/\-_.]{2,40})/i,
      /nit\s*(?:no|number)[.:\s]*([A-Z0-9][A-Z0-9/\-_.]{2,40})/i,
      /e-?tender\s*(?:no|id)[.:\s]*([A-Z0-9][A-Z0-9/\-_.]{2,40})/i,
    ],
    pageHints: ['tender', 'nit', 'reference'],
    maxLength: 80,
  },
  {
    id: 'tenderReferenceNumber',
    label: 'Tender Reference Number',
    mergeKey: 'tenderReferenceNumber',
    section: 'general',
    valueType: 'text',
    labels: ['reference number', 'tender reference', 'ref no', 'rfp no'],
    patterns: [
      /(?:reference|ref)\s*(?:no|number)[.:\s]*([A-Z0-9][A-Z0-9/\-_.]{2,40})/i,
    ],
    pageHints: ['reference', 'nit'],
    maxLength: 80,
  },
  {
    id: 'department',
    label: 'Department',
    mergeKey: 'department',
    section: 'general',
    valueType: 'text',
    labels: ['department', 'division', 'name of department'],
    patterns: [
      /(?:department|division)[:\s]+([^\n]{3,120})/i,
    ],
    pageHints: ['department', 'organisation'],
    maxLength: 120,
  },
  {
    id: 'organization',
    label: 'Organization',
    mergeKey: 'organization',
    section: 'general',
    valueType: 'text',
    labels: ['tendering authority', 'issuing authority', 'organisation', 'organization', 'department'],
    patterns: [
      /(?:tendering authority|issuing authority|name of organisation)[:\s]+([^\n]{3,120})/i,
    ],
    pageHints: ['authority', 'organisation'],
    maxLength: 150,
  },
  {
    id: 'estimatedTenderValue',
    label: 'Estimated Tender Value',
    mergeKey: 'estimatedTenderValue',
    section: 'financial',
    valueType: 'money',
    labels: ['estimated value', 'tender value', 'contract value', 'cost of work', 'approximate value'],
    patterns: [
      /(?:estimated\s+(?:contract\s+)?value|tender\s+value|cost\s+of\s+work)[^₹\d]{0,50}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?(?:\s*(?:Cr|Lakh|Lac))?)/i,
    ],
    pageHints: ['financial', 'cost', 'value', 'schedule'],
    maxLength: 80,
  },
  {
    id: 'emdAmount',
    label: 'EMD Amount',
    mergeKey: 'emdAmount',
    section: 'financial',
    valueType: 'money',
    labels: ['emd', 'earnest money deposit', 'earnest money', 'bid security amount'],
    patterns: [
      /(?:emd|earnest\s+money(?:\s+deposit)?)[^₹\d]{0,50}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?)/i,
    ],
    pageHints: ['emd', 'earnest', 'financial', 'instruction'],
    maxLength: 80,
  },
  {
    id: 'tenderFee',
    label: 'Tender Fee',
    mergeKey: 'tenderFee',
    section: 'financial',
    valueType: 'money',
    labels: ['tender fee', 'cost of tender document', 'document fee', 'tender document cost'],
    synonymLabels: ['non-refundable fee', 'processing fee', 'bid document fee', 'cost of bid document'],
    patterns: [
      /tender\s+fee[^₹\d]{0,50}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?)/i,
      /(?:cost\s+of\s+tender\s+document|document\s+fee)[^₹\d]{0,40}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?)/i,
    ],
    pageHints: ['fee', 'document cost', 'financial', 'instruction'],
    maxLength: 80,
  },
  {
    id: 'performanceSecurity',
    label: 'Performance Security',
    mergeKey: 'performanceSecurity',
    section: 'financial',
    valueType: 'money',
    labels: ['performance security', 'security deposit', 'performance guarantee', 'performance bank guarantee'],
    synonymLabels: ['pbg', 'contract performance guarantee', 'security amount'],
    patterns: [
      /performance\s+security[^₹%\d]{0,50}([\d.,]+\s*%|(?:Rs\.?|₹)\s*[\d,]+(?:\.\d+)?)/i,
      /performance\s+guarantee[^₹%\d]{0,50}([\d.,]+\s*%|(?:Rs\.?|₹)\s*[\d,]+(?:\.\d+)?)/i,
      /security\s+deposit[^₹%\d]{0,40}([\d.,]+\s*%|(?:Rs\.?|₹)\s*[\d,]+(?:\.\d+)?)/i,
    ],
    pageHints: ['performance', 'security', 'guarantee', 'financial', 'bank'],
    maxLength: 100,
  },
  {
    id: 'bankGuarantee',
    label: 'Bank Guarantee',
    mergeKey: 'bankGuarantee',
    section: 'financial',
    valueType: 'money',
    labels: ['bank guarantee', 'performance bank guarantee', 'pbg'],
    patterns: [
      /(?:performance\s+)?bank\s+guarantee[^₹%\d]{0,40}([\d.,]+\s*%|(?:Rs\.?|₹)\s*[\d,]+(?:\.\d+)?)/i,
    ],
    pageHints: ['bank guarantee', 'pbg'],
    maxLength: 100,
  },
  {
    id: 'bidSubmissionDate',
    label: 'Bid Submission Date',
    mergeKey: 'bidSubmissionDate',
    section: 'timeline',
    valueType: 'date',
    labels: ['last date', 'bid submission', 'submission date', 'due date', 'closing date'],
    patterns: [
      /(?:last\s+date|bid\s+submission|due\s+date|closing\s+date)[^:\n]{0,50}[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i,
      /(?:last\s+date|bid\s+submission)[^:\n]{0,50}[:\s]+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
    ],
    pageHints: ['date', 'schedule', 'submission', 'important'],
    maxLength: 60,
  },
  {
    id: 'bidOpeningDate',
    label: 'Bid Opening Date',
    mergeKey: 'bidOpeningDate',
    section: 'timeline',
    valueType: 'date',
    labels: ['bid opening', 'opening date', 'technical bid opening', 'financial bid opening'],
    patterns: [
      /(?:bid\s+opening|opening\s+of\s+bid)[^:\n]{0,50}[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i,
      /(?:technical|financial)\s+bid\s+opening[^:\n]{0,40}[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
    ],
    pageHints: ['opening', 'date', 'schedule'],
    maxLength: 60,
  },
  {
    id: 'preBidMeetingDate',
    label: 'Pre-Bid Meeting Date',
    mergeKey: 'preBidMeetingDate',
    section: 'timeline',
    valueType: 'date',
    labels: ['pre-bid meeting', 'pre bid meeting', 'pre-bid conference'],
    patterns: [
      /pre-?\s*bid\s+meeting[^:\n]{0,50}[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i,
    ],
    pageHints: ['pre-bid', 'meeting', 'date'],
    maxLength: 60,
  },
  {
    id: 'bidSecurityAmount',
    label: 'Bid Security',
    mergeKey: 'bidSecurityAmount',
    section: 'financial',
    valueType: 'money',
    labels: ['bid security', 'tender security', 'security for bid'],
    synonymLabels: ['bid securing instrument'],
    patterns: [
      /bid\s+security[^₹\d]{0,50}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?|\d+\s*%)/i,
    ],
    pageHints: ['bid security', 'financial'],
    maxLength: 100,
  },
  {
    id: 'contractDuration',
    label: 'Contract Duration',
    mergeKey: 'contractDuration',
    section: 'timeline',
    valueType: 'duration',
    labels: ['contract period', 'completion period', 'contract duration', 'period of completion'],
    synonymLabels: [
      'duration',
      'validity period',
      'period of contract',
      'engagement period',
      'time for completion',
      'completion time',
    ],
    patterns: [
      /(?:contract\s+period|completion\s+(?:period|time)|duration\s+of\s+contract|validity\s+period|engagement\s+period)[^:\n]{0,50}[:\s]+([^\n]{4,100})/i,
      /(?:within|in|shall\s+be\s+completed\s+within)\s+(\d+\s*(?:days|months|weeks|years)(?:\s+from[^.\n]{0,40})?)/i,
      /(?:period\s+of\s+completion)[^:\n]{0,30}[:\s]+([^\n]{4,100})/i,
    ],
    pageHints: ['completion', 'contract period', 'duration', 'schedule', 'timeline'],
    maxLength: 100,
  },
  {
    id: 'turnoverRequirements',
    label: 'Turnover Requirement',
    mergeKey: 'turnoverRequirements',
    section: 'eligibility',
    valueType: 'list',
    labels: ['turnover', 'annual turnover', 'average turnover', 'revenue', 'financial turnover'],
    synonymLabels: [
      'minimum turnover',
      'average annual turnover',
      'turnover criteria',
      'financial capacity',
    ],
    patterns: [
      /(?:turnover|annual\s+turnover|average\s+turnover)[^:\n]{0,50}[:\s]+([^\n]{5,200})/i,
      /(?:minimum\s+(?:average\s+)?turnover)[^:\n]{0,40}[:\s]+([^\n]{5,200})/i,
    ],
    pageHints: ['eligibility', 'qualification', 'financial', 'annexure'],
    maxLength: 200,
    listMaxItems: 3,
  },
  {
    id: 'experienceRequirements',
    label: 'Experience Requirement',
    mergeKey: 'experienceRequirements',
    section: 'eligibility',
    valueType: 'list',
    labels: ['experience', 'similar work', 'past experience', 'years of experience', 'technical experience'],
    synonymLabels: [
      'similar nature of work',
      'work experience',
      'completed projects',
      'past performance',
      'relevant experience',
    ],
    patterns: [
      /(?:experience|similar\s+work|similar\s+nature)[^:\n]{0,50}[:\s]+([^\n]{5,250})/i,
      /(?:should\s+have\s+(?:successfully\s+)?completed)[^:\n]{0,40}([^\n]{5,250})/i,
    ],
    pageHints: ['eligibility', 'qualification', 'experience', 'technical', 'annexure'],
    maxLength: 250,
    listMaxItems: 5,
  },
  {
    id: 'gstRequirement',
    label: 'GST Requirement',
    mergeKey: 'statutoryRequirements',
    section: 'eligibility',
    valueType: 'text',
    labels: ['gst', 'gstin', 'gst registration'],
    patterns: [
      /(?:gst|gstin)[^:\n]{0,30}[:\s]+([^\n]{5,120})/i,
      /(valid\s+gst[^\n]{5,100})/i,
    ],
    pageHints: ['gst', 'statutory', 'eligibility'],
    maxLength: 120,
  },
  {
    id: 'epfRequirement',
    label: 'EPF Requirement',
    mergeKey: 'statutoryRequirements',
    section: 'eligibility',
    valueType: 'text',
    labels: ['epf', 'epf registration', 'provident fund'],
    patterns: [/(?:epf|provident\s+fund)[^:\n]{0,30}[:\s]+([^\n]{5,120})/i],
    pageHints: ['epf', 'statutory'],
    maxLength: 120,
  },
  {
    id: 'esiRequirement',
    label: 'ESI Requirement',
    mergeKey: 'statutoryRequirements',
    section: 'eligibility',
    valueType: 'text',
    labels: ['esi', 'esi registration', 'employees state insurance'],
    patterns: [/(?:esi|employees\s+state\s+insurance)[^:\n]{0,30}[:\s]+([^\n]{5,120})/i],
    pageHints: ['esi', 'statutory'],
    maxLength: 120,
  },
  {
    id: 'labourLicense',
    label: 'Labour License Requirement',
    mergeKey: 'licensesRequired',
    section: 'eligibility',
    valueType: 'text',
    labels: ['labour license', 'labor license', 'contract labour'],
    patterns: [/(?:labou?r\s+license|contract\s+labou?r)[^:\n]{0,30}[:\s]+([^\n]{5,120})/i],
    pageHints: ['labour', 'license'],
    maxLength: 120,
  },
  {
    id: 'certificationsRequired',
    label: 'Required Certifications',
    mergeKey: 'certificationsRequired',
    section: 'eligibility',
    valueType: 'list',
    labels: ['certification', 'iso', 'quality certificate', 'required certificates'],
    patterns: [
      /(?:iso|certification)[^:\n]{0,40}[:\s]+([^\n]{5,200})/i,
    ],
    pageHints: ['certification', 'eligibility', 'quality'],
    maxLength: 200,
    listMaxItems: 8,
  },
  {
    id: 'workLocation',
    label: 'Work Location',
    mergeKey: 'workLocation',
    section: 'general',
    valueType: 'text',
    labels: ['work location', 'site of work', 'place of work', 'location of work'],
    synonymLabels: [
      'place of service',
      'project location',
      'site location',
      'location of service',
      'work site',
      'job location',
    ],
    patterns: [
      /(?:work\s+location|site\s+of\s+work|place\s+of\s+work|project\s+location|site\s+location)[:\s]+([^\n]{3,120})/i,
      /(?:location\s+of\s+(?:work|service))[:\s]+([^\n]{3,120})/i,
    ],
    pageHints: ['location', 'site', 'place of work', 'nit'],
    maxLength: 120,
    rejectIfContains: [/shall be submitted/i, /online/i],
  },
  {
    id: 'reverseAuction',
    label: 'Reverse Auction',
    mergeKey: 'complianceRequirements',
    section: 'compliance',
    valueType: 'text',
    labels: ['reverse auction', 'e-reverse auction', 'online auction', 'e-auction'],
    patterns: [
      /reverse\s+(?:auction|bidding)[:\s]+(yes|no|applicable|not applicable)/i,
      /(e-?reverse\s+auction[^\n]{0,40})/i,
    ],
    pageHints: ['nit', 'commercial', 'bid', 'condition'],
    maxLength: 40,
  },
  {
    id: 'submissionMode',
    label: 'Submission Mode',
    mergeKey: 'submissionMode',
    section: 'general',
    valueType: 'text',
    labels: ['mode of submission', 'submission mode', 'online submission', 'e-tender'],
    synonymLabels: [
      'online bid',
      'electronic submission',
      'e-procurement',
      'nic portal',
      'gem portal',
      'bidding mode',
    ],
    patterns: [
      /(?:mode\s+of\s+submission|submission\s+mode|bidding\s+mode)[:\s]+([^\n]{5,100})/i,
      /((?:online|electronic)\s*(?:bid|submission|tendering)[^\n]{0,80})/i,
      /(e-?tender(?:ing)?(?:\s+portal)?[^\n]{0,60})/i,
      /((?:nic|gem|eproc|e-proc)\s+portal[^\n]{0,60})/i,
    ],
    pageHints: ['submission', 'portal', 'e-tender', 'online', 'instruction'],
    maxLength: 60,
    rejectIfContains: [
      /technical\s+requirement/i,
      /cctv/i,
      /camera/i,
      /specification/i,
      /supply\s+of/i,
      /shall\s+comply/i,
    ],
  },
  {
    id: 'requiredDocuments',
    label: 'Required Documents',
    mergeKey: 'requiredDocuments',
    section: 'documents',
    valueType: 'list',
    labels: ['required documents', 'documents to be submitted', 'enclosures', 'bid documents'],
    patterns: [],
    pageHints: ['document', 'enclosure', 'annexure', 'checklist'],
    maxLength: 120,
    listMaxItems: 20,
  },
  {
    id: 'technicalRequirements',
    label: 'Technical Requirements',
    mergeKey: 'technicalRequirements',
    section: 'technical',
    valueType: 'list',
    labels: ['technical requirement', 'technical specification', 'technical bid', 'specification'],
    patterns: [],
    pageHints: ['technical', 'specification', 'schedule'],
    maxLength: 200,
    listMaxItems: 12,
  },
  {
    id: 'financialRequirements',
    label: 'Financial Requirements',
    mergeKey: 'financialRequirements',
    section: 'financial',
    valueType: 'list',
    labels: ['financial requirement', 'financial criteria', 'financial qualification'],
    patterns: [],
    pageHints: ['financial', 'eligibility', 'turnover'],
    maxLength: 200,
    listMaxItems: 8,
  },
  {
    id: 'complianceRequirements',
    label: 'Compliance Requirements',
    mergeKey: 'complianceRequirements',
    section: 'compliance',
    valueType: 'list',
    labels: ['compliance', 'statutory compliance', 'legal requirement', 'registration'],
    patterns: [],
    pageHints: ['compliance', 'statutory', 'legal'],
    maxLength: 200,
    listMaxItems: 10,
  },
  {
    id: 'scopeOfWork',
    label: 'Scope of Work',
    mergeKey: 'scopeOfWork',
    section: 'general',
    valueType: 'text',
    labels: ['scope of work', 'nature of work', 'description of work'],
    patterns: [
      /(?:scope\s+of\s+work|nature\s+of\s+work|description\s+of\s+work)[:\s]+([^\n]{15,400})/i,
    ],
    pageHints: ['scope', 'work', 'nit'],
    maxLength: 400,
    rejectIfContains: [/the bidder shall/i],
  },
  {
    id: 'risks',
    label: 'Risk Factors',
    mergeKey: 'risks',
    section: 'risk',
    valueType: 'list',
    labels: ['penalty', 'liquidated damages', 'forfeiture', 'disqualification', 'termination'],
    patterns: [],
    pageHints: ['penalty', 'risk', 'condition', 'special'],
    maxLength: 200,
    listMaxItems: 8,
  },
];

for (const f of ENTERPRISE_PRODUCTION_FIELDS) {
  if (!PRODUCTION_FIELDS.some((p) => p.id === f.id)) {
    PRODUCTION_FIELDS.push(f);
  }
}

export const FIELD_BY_ID = Object.fromEntries(PRODUCTION_FIELDS.map((f) => [f.id, f])) as Record<
  string,
  ProductionFieldDefinition
>;

export function isMoneyType(t: FieldValueType): boolean {
  return t === 'money';
}

export function isDateType(t: FieldValueType): boolean {
  return t === 'date';
}

export { MONEY, DATE };
