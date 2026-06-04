import {
  ExtractedField,
  IntelligenceFieldKey,
  MergedField,
  MergedIntelligence,
} from '../../types/intelligence';
import { ALL_INTELLIGENCE_FIELDS, CONFIDENCE_THRESHOLD, LIST_FIELDS } from './fields';
import { validateFieldDictionary } from './fieldDictionaryEngine';

/** Legal/boilerplate phrases that indicate paragraph capture, not field values. */
const BOILERPLATE_PATTERNS = [
  /\bthe bidder shall\b/i,
  /\bfurther(?:more)?\b/i,
  /\bnotwithstanding\b/i,
  /\bhereinafter\b/i,
  /\bwhereas\b/i,
  /\bshall not be allowed\b/i,
  /\bin the event that\b/i,
  /\bwithout prejudice\b/i,
  /\bany breach of\b/i,
  /\bdisqualification\b/i,
  /\bterms and conditions\b/i,
  /\bthe tenderer shall\b/i,
  /\bthe contractor shall\b/i,
];

const SHORT_SCALAR_FIELDS: IntelligenceFieldKey[] = [
  'tenderName',
  'tenderNumber',
  'tenderReferenceNumber',
  'department',
  'organization',
  'issuingAuthority',
  'tenderType',
  'tenderCategory',
  'estimatedTenderValue',
  'emdAmount',
  'emdExemption',
  'bidSecurityAmount',
  'tenderFee',
  'performanceSecurity',
  'bankGuarantee',
  'tenderPublishDate',
  'preBidMeetingDate',
  'bidSubmissionStartDate',
  'bidSubmissionDate',
  'bidOpeningDate',
  'technicalBidOpeningDate',
  'financialBidOpeningDate',
  'contractDuration',
  'workLocation',
  'serviceCategory',
  'contactDetails',
  'submissionMode',
  'paymentTerms',
  'liquidatedDamages',
  'penalties',
];

const MAX_LENGTH: Partial<Record<IntelligenceFieldKey, number>> = {
  tenderName: 350,
  tenderNumber: 120,
  tenderReferenceNumber: 120,
  department: 200,
  organization: 250,
  issuingAuthority: 250,
  tenderType: 120,
  tenderCategory: 120,
  estimatedTenderValue: 120,
  emdAmount: 120,
  emdExemption: 300,
  bidSecurityAmount: 120,
  tenderFee: 120,
  performanceSecurity: 200,
  bankGuarantee: 200,
  tenderPublishDate: 80,
  preBidMeetingDate: 80,
  bidSubmissionStartDate: 80,
  bidSubmissionDate: 80,
  bidOpeningDate: 80,
  technicalBidOpeningDate: 80,
  financialBidOpeningDate: 80,
  contractDuration: 150,
  workLocation: 300,
  serviceCategory: 200,
  scopeOfWork: 2500,
  contactDetails: 400,
  submissionMode: 200,
  paymentTerms: 800,
  liquidatedDamages: 600,
  penalties: 600,
};

const LIST_ITEM_MAX = 450;

const MONEY_PATTERN =
  /(?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d{1,2})?\s*(?:\/-)?(?:\s*(?:lakh|lac|crore|cr|million|thousand|k))?|\d+\s*%/i;

const DATE_PATTERN =
  /\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceCount(text: string): number {
  return (text.match(/[.!?]+/g) || []).length;
}

/** Detect paragraph/legal text unsuitable for scalar fields. */
export function isParagraphText(value: string, field?: IntelligenceFieldKey): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;

  if (trimmed.length > 600 && field !== 'scopeOfWork') return true;

  const words = wordCount(trimmed);
  const sentences = sentenceCount(trimmed);

  if (field && SHORT_SCALAR_FIELDS.includes(field)) {
    if (words > 35) return true;
    if (sentences >= 2 && words > 20) return true;
    if (trimmed.startsWith('and ') || trimmed.startsWith('the bidder') || trimmed.startsWith('further')) {
      return true;
    }
  }

  for (const pattern of BOILERPLATE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  if (sentences >= 3 && words > 30) return true;

  return false;
}

function validateMoneyField(value: string): boolean {
  return MONEY_PATTERN.test(value) || /^(?:nil|na|n\/a|not applicable|exempt(?:ed)?)$/i.test(value.trim());
}

function validateDateField(value: string): boolean {
  return DATE_PATTERN.test(value) || /^\d{1,2}:\d{2}/.test(value);
}

function validateScalarValue(field: IntelligenceFieldKey, value: string): boolean {
  const maxLen = MAX_LENGTH[field] ?? 400;
  if (value.length > maxLen) return false;
  if (isParagraphText(value, field)) return false;

  const moneyFields: IntelligenceFieldKey[] = [
    'estimatedTenderValue',
    'emdAmount',
    'bidSecurityAmount',
    'tenderFee',
    'performanceSecurity',
    'bankGuarantee',
  ];
  if (moneyFields.includes(field) && !validateMoneyField(value)) return false;

  const dateFields: IntelligenceFieldKey[] = [
    'tenderPublishDate',
    'preBidMeetingDate',
    'bidSubmissionStartDate',
    'bidSubmissionDate',
    'bidOpeningDate',
    'technicalBidOpeningDate',
    'financialBidOpeningDate',
  ];
  if (dateFields.includes(field) && !validateDateField(value)) return false;

  if (field === 'tenderName') {
    if (value.length < 5) return false;
    if (/^\d+$/.test(value)) return false;
  }

  if (field === 'tenderNumber' || field === 'tenderReferenceNumber') {
    if (value.length < 2) return false;
  }

  if (field === 'contractDuration') {
    if (
      !/\d+\s*(?:day|days|month|months|week|weeks|year|years)/i.test(value) &&
      !/(?:period|completion|validity|duration|months?|years?)/i.test(value)
    ) {
      return false;
    }
    if (value.length < 3) return false;
  }

  if (field === 'submissionMode') {
    const dict = validateFieldDictionary('submissionMode', value, '');
    return dict.valid;
  }

  if (['gstRequirement', 'epfRequirement', 'esiRequirement'].includes(field)) {
    const dict = validateFieldDictionary(field, value, '');
    return dict.valid;
  }

  if (field === 'workLocation' && value.length < 3) return false;

  return true;
}

function validateListItem(field: IntelligenceFieldKey, item: string): boolean {
  const trimmed = item.trim();
  if (!trimmed || trimmed.length < 3) return false;
  if (trimmed.length > LIST_ITEM_MAX) return false;
  if (isParagraphText(trimmed, field)) return false;
  if (wordCount(trimmed) > 60) return false;
  return true;
}

/** Validate a single extraction before merge. Returns null if rejected. */
export function validateExtraction(
  field: IntelligenceFieldKey,
  extraction: ExtractedField
): ExtractedField | null {
  if (extraction.value === null || extraction.value === undefined) return null;
  if (extraction.confidence < CONFIDENCE_THRESHOLD) return null;
  if (!extraction.page || extraction.page < 1) return null;

  if (Array.isArray(extraction.value)) {
    const validItems = extraction.value
      .map(String)
      .map((v) => v.trim())
      .filter((v) => validateListItem(field, v));
    if (!validItems.length) return null;
    return { ...extraction, value: validItems };
  }

  const str = String(extraction.value).trim();
  if (!str) return null;

  if (LIST_FIELDS.includes(field)) {
    if (!validateListItem(field, str)) return null;
    return { ...extraction, value: str };
  }

  if (!validateScalarValue(field, str)) return null;
  return { ...extraction, value: str };
}

/** Filter extractions array through validation rules. */
export function filterValidExtractions(
  field: IntelligenceFieldKey,
  extractions: ExtractedField[]
): ExtractedField[] {
  return extractions
    .map((e) => validateExtraction(field, e))
    .filter((e): e is ExtractedField => e !== null);
}

const EMPTY_FIELD: MergedField = {
  value: null,
  sourcePages: [],
  confidence: 0,
  validated: false,
  allExtractions: [],
};

/** Validate merged field — null out invalid values. */
export function validateMergedField(
  field: IntelligenceFieldKey,
  merged: MergedField
): MergedField {
  if (!merged?.value) {
    return { ...EMPTY_FIELD };
  }

  const validExtractions = filterValidExtractions(field, merged.allExtractions || []);

  if (LIST_FIELDS.includes(field)) {
    const items = Array.isArray(merged.value)
      ? merged.value.map(String)
      : [String(merged.value)];
    const validItems = items.filter((item) => validateListItem(field, item));
    if (!validItems.length) return { ...EMPTY_FIELD };

    const pages = validExtractions.length
      ? [...new Set(validExtractions.map((e) => e.page))].sort((a, b) => a - b)
      : merged.sourcePages;
    const avgConf =
      validExtractions.length > 0
        ? validExtractions.reduce((s, e) => s + e.confidence, 0) / validExtractions.length
        : merged.confidence;

    return {
      value: validItems,
      sourcePages: pages,
      confidence: avgConf,
      validated: avgConf >= CONFIDENCE_THRESHOLD,
      allExtractions: validExtractions,
    };
  }

  const str = Array.isArray(merged.value) ? merged.value[0] : String(merged.value);
  if (!validateScalarValue(field, str)) return { ...EMPTY_FIELD };

  const best = validExtractions[0] || merged;
  return {
    value: str.trim(),
    sourcePages: merged.sourcePages?.length
      ? merged.sourcePages
      : best.page
        ? [best.page]
        : [],
    confidence: best.confidence ?? merged.confidence,
    validated: (best.confidence ?? merged.confidence) >= CONFIDENCE_THRESHOLD,
    allExtractions: validExtractions,
  };
}

/** Stage 2 — validate entire merged intelligence document. */
export function validateIntelligence(merged: MergedIntelligence): MergedIntelligence {
  const validated = {} as MergedIntelligence;
  for (const field of ALL_INTELLIGENCE_FIELDS) {
    validated[field] = validateMergedField(field, merged[field] || EMPTY_FIELD);
  }
  return validated;
}
