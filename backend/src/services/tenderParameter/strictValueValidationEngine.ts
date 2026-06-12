import { MasterDatasetKey } from '../../types/masterDataset';
import {
  DATE_PARAMETER_KEYS,
  hasForbiddenTenderValueContext,
  isValidDateValue,
} from './parameterValidationRules';

export type StrictValidationStatus = 'VALID' | 'REVIEW' | 'REJECT';

export type StrictValueParameterKind =
  | 'emd'
  | 'tender_value'
  | 'financial_amount'
  | 'bid_date'
  | 'completion_period'
  | 'duration'
  | 'gst'
  | 'pan'
  | 'percentage'
  | 'experience'
  | 'scope';

export interface StrictValueValidationResult {
  status: StrictValidationStatus;
  reason: string;
  rule?: string;
}

const EMD_CURRENCY_MARKER_RX = /(?:₹|rs\.?\b|inr\b|\blakh\b|\blac\b|\bcrore\b|\bcr\b)/i;

const FINANCIAL_CURRENCY_RX =
  /(?:₹|rs\.?\b|inr\b|\blakh\b|\blac\b|\bcrore\b|\bcr\b|\$|€|£)?\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+(?:\.\d{1,2})?\s*(?:lakh|lac|crore|cr|thousand|k)\b/i;

const TURNover_EXPERIENCE_IN_VALUE_RX =
  /\b(turnover|experience|years?\s+of\s+experience|similar\s+work|annual\s+turnover|past\s+experience|work\s+experience|minimum\s+experience|average\s+turnover)\b/i;

const PERIOD_UNIT_RX = /\b(\d+\s*)?(days?|months?|years?|weeks?)\b/i;

const PERIOD_NUMERIC_RX = /\b\d+\s*(?:days?|months?|years?|weeks?)\b/i;

const CLAUSE_NUMBER_RX = /^\d+(?:\.\d+)+[\.\):]?\s*$/;

const CLAUSE_NUMBER_LEADING_RX = /^\d+(?:\.\d+)+[\.\):]\s+/;

const HEADING_RX =
  /^(?:section|clause|annexure|schedule|particulars|note|chapter|part|item|sl\.?\s*no|sr\.?\s*no)\b/i;

const PROSE_CLAUSE_RX =
  /\b(shall|must|will\s+be|should\s+be|contractor\s+shall|bidder\s+shall|provided\s+that|notwithstanding|hereinafter|subject\s+to|in\s+accordance)\b/i;

const NAVIGATION_RX =
  /\b(go\s+to|click\s+here|refer\s+annexure|see\s+annexure|table\s+of\s+contents|index\s+of)\b/i;

const ANNEXURE_REF_RX = /\b(?:annexure|appendix|enclosure|schedule)\s+[a-z0-9ivxlc]+\b/i;

const WORDS_ONLY_RX = /^[a-zA-Z\s,.\-/()&]+$/;

const BROKEN_OCR_PERIOD_RX = /^[\d.,()/\s-]{1,6}$/;

const PARTIAL_TOKEN_RX = /^[\d.,()/-]+$/;

const PARTIAL_DATE_RX = /^\d{1,2}[\-/.(]$|^\d{1,2}-$|^[\d.,\s(/-]{1,5}$/;

const DATE_SECTION_NAME_RX =
  /^(technical|financial|eligibility|compliance|identity|timeline|scope|experience|annexure|section\s+\d+|part\s+[ivxlc\d]+)$/i;

const MONTH_ONLY_RX = /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

const GSTIN_RX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

const PAN_RX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const SCOPE_HEADING_RX =
  /^(?:scope|services|deliverables|activities|responsibilities|&\s*location|location|section\s+\d+(?:\.\d+)*)$/i;

const EXPERIENCE_HEADING_RX =
  /^(?:experience|similar\s+work|work\s+orders?|completion\s+certificates?|index|contents|table\s+of\s+contents)$/i;

function reject(reason: string, rule: string): StrictValueValidationResult {
  return { status: 'REJECT', reason, rule };
}

function review(reason: string, rule: string): StrictValueValidationResult {
  return { status: 'REVIEW', reason, rule };
}

function valid(reason: string): StrictValueValidationResult {
  return { status: 'VALID', reason, rule: 'strict_pass' };
}

function hasNumericAmount(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 2;
}

function extractGstin(value: string): string | null {
  const match = value.replace(/\s/g, '').match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]/i);
  return match ? match[0].toUpperCase() : null;
}

function extractPan(value: string): string | null {
  const match = value.replace(/\s/g, '').match(/[A-Z]{5}[0-9]{4}[A-Z]/);
  return match ? match[0].toUpperCase() : null;
}

export function isParagraphOrClauseText(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (v.length > 200) return true;
  if (PROSE_CLAUSE_RX.test(v)) return true;
  if (NAVIGATION_RX.test(v)) return true;
  if (ANNEXURE_REF_RX.test(v) && v.split(/\s+/).length <= 8) return true;
  const sentences = v.split(/[.!?]/).filter((s) => s.trim().length > 40);
  if (sentences.length >= 2) return true;
  if (CLAUSE_NUMBER_LEADING_RX.test(v) && v.length > 60) return true;
  return false;
}

export function isHeadingText(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (HEADING_RX.test(v)) return true;
  if (DATE_SECTION_NAME_RX.test(v)) return true;
  if (v.length <= 80 && v === v.toUpperCase() && /[A-Z]{4,}/.test(v)) return true;
  return false;
}

export function resolveStrictParameterKind(
  canonicalKey?: string,
  parameter?: string
): StrictValueParameterKind | null {
  const key = canonicalKey as MasterDatasetKey | undefined;
  if (key === 'emdAmount') return 'emd';
  if (key === 'tenderValue' || key === 'estimatedCost') return 'tender_value';
  if (
    key === 'documentFee' ||
    key === 'performanceSecurity' ||
    key === 'bankGuarantee'
  ) {
    return 'financial_amount';
  }
  if (key && DATE_PARAMETER_KEYS.has(key)) return 'bid_date';
  if (key === 'completionPeriod' || key === 'contractPeriod') return 'completion_period';
  if (key === 'gst') return 'gst';
  if (key === 'pan') return 'pan';
  if (key === 'experienceRequirement') return 'experience';
  if (key === 'scopeOfWork') return 'scope';

  const label = (parameter || '').toLowerCase();

  if (/\b(emd|earnest\s+money(\s+deposit)?|bid\s+security(\s+amount)?)\b/.test(label)) return 'emd';
  if (/\b(tender\s+value|estimated\s+cost|project\s+cost|contract\s+value|estimated\s+tender\s+value|work\s+value)\b/.test(label)) {
    return 'tender_value';
  }
  if (/\b(tender\s+fee|document\s+fee|bid\s+fee|security\s+deposit|performance\s+security|performance\s+guarantee|bank\s+guarantee|pbg|ebg)\b/.test(label)) {
    return 'financial_amount';
  }
  if (
    /\b(bid\s+(start|end|opening|closing|submission)\s*date|last\s+date|submission\s+deadline|pre[\s-]?bid|technical\s+(?:opening|bid)|financial\s+(?:opening|bid)|publishing\s+date|nit\s+date)\b/.test(
      label
    )
  ) {
    return 'bid_date';
  }
  if (/\b(completion\s+period|contract\s+period|time\s+for\s+completion|duration\s+of\s+work)\b/.test(label)) {
    return 'completion_period';
  }
  if (/\b(bid\s+validity|warranty\s+period|amc\s+duration|defect\s+liability)\b/.test(label)) {
    return 'duration';
  }
  if (/\bgst\b|\bgstin\b/.test(label)) return 'gst';
  if (/\bpan\b|\bpermanent\s+account\s+number\b/.test(label)) return 'pan';
  if (/\b(emd\s+percentage|pbg\s+percentage|performance\s+security\s+percentage|experience\s+percentage)\b/.test(label) || (/\bpercentage\b/.test(label) && /%/.test(label))) {
    return 'percentage';
  }
  if (/\b(experience\s+requirement|similar\s+work|work\s+completion|past\s+project|client\s+reference)\b/.test(label)) {
    return 'experience';
  }
  if (/\b(scope\s+of\s+work|services|deliverables|deployment|activities|responsibilities)\b/.test(label)) {
    return 'scope';
  }
  return null;
}

function validateFinancialAmount(value: string, label: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject(`${label} is empty`, 'financial_empty');
  if (isHeadingText(v)) return reject(`${label} is a heading — not an amount`, 'financial_heading');
  if (isParagraphOrClauseText(v)) return reject(`${label} is paragraph or clause text`, 'financial_prose');
  if (!EMD_CURRENCY_MARKER_RX.test(v) && !FINANCIAL_CURRENCY_RX.test(v)) {
    return reject(`${label} must contain ₹, Rs, INR, Lakh, Crore, or numeric amount`, 'financial_missing_currency');
  }
  if (!hasNumericAmount(v)) return reject(`${label} must contain a valid numeric amount`, 'financial_invalid_amount');
  if (TURNover_EXPERIENCE_IN_VALUE_RX.test(v)) {
    return reject(`${label} appears to be turnover or experience text`, 'financial_wrong_field');
  }
  return valid(`Passed Financial Validation for ${label}`);
}

export function validateStrictEmdValue(value: string): StrictValueValidationResult {
  return validateFinancialAmount(value, 'EMD Amount');
}

export function validateStrictTenderValueValue(value: string, context = ''): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('Tender Value is empty', 'tender_value_empty');
  if (isHeadingText(v)) return reject('Tender Value is a heading', 'tender_value_heading');
  if (isParagraphOrClauseText(v)) return reject('Tender Value is explanatory or clause text', 'tender_value_prose');
  if (TURNover_EXPERIENCE_IN_VALUE_RX.test(v)) {
    return reject('Tender Value contains turnover or experience text', 'tender_value_turnover_experience');
  }
  if (hasForbiddenTenderValueContext(context) || TURNover_EXPERIENCE_IN_VALUE_RX.test(context)) {
    return reject('Tender Value context indicates turnover or experience field', 'tender_value_wrong_context');
  }
  if (!FINANCIAL_CURRENCY_RX.test(v)) {
    return review('Tender Value missing clear currency amount format', 'tender_value_currency_review');
  }
  if (!hasNumericAmount(v)) return reject('Tender Value must contain a valid numeric amount', 'tender_value_invalid_amount');
  return valid('Passed Financial Validation for Tender Value');
}

export function validateStrictBidDateValue(value: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('Date is empty', 'bid_date_empty');
  if (isHeadingText(v)) return reject('Date value is a heading or section name', 'bid_date_heading');
  if (DATE_SECTION_NAME_RX.test(v)) return reject('Date value is a section name — not a date', 'bid_date_section_name');
  if (CLAUSE_NUMBER_RX.test(v)) return reject('Date value is a clause number', 'bid_date_clause_number');
  if (PARTIAL_DATE_RX.test(v)) return reject('Date value is partial or broken OCR', 'bid_date_partial');
  if (MONTH_ONLY_RX.test(v)) return reject('Date value is month name only — not a complete date', 'bid_date_month_only');
  if (CLAUSE_NUMBER_LEADING_RX.test(v) && !/\d{1,2}[\s./-]\d{1,2}/.test(v)) {
    return reject('Date value is a clause reference — not a date', 'bid_date_clause_ref');
  }
  if (WORDS_ONLY_RX.test(v) && !/\d/.test(v)) {
    return reject('Date contains words only — no valid date', 'bid_date_words_only');
  }
  if (isParagraphOrClauseText(v)) return reject('Date value is clause or paragraph text', 'bid_date_prose');
  if (isValidDateValue(v)) return valid('Passed Date Validation');
  if (/\d{1,2}[\s./-]\d{1,2}/.test(v) || /\d{4}/.test(v)) {
    return review('Date format unclear — needs review', 'bid_date_format_review');
  }
  return reject('Date does not match a valid date format', 'bid_date_invalid');
}

function validateDurationValue(value: string, label: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject(`${label} is empty`, 'duration_empty');
  if (isHeadingText(v)) return reject(`${label} is a heading`, 'duration_heading');
  if (isParagraphOrClauseText(v)) return reject(`${label} is clause or paragraph text`, 'duration_prose');
  if (BROKEN_OCR_PERIOD_RX.test(v) || PARTIAL_TOKEN_RX.test(v) || /^\d{1,2}\($/.test(v)) {
    return reject(`${label} is a broken OCR token`, 'duration_broken_ocr');
  }
  if (PERIOD_NUMERIC_RX.test(v) || PERIOD_UNIT_RX.test(v)) {
    const numMatch = v.match(/\d+/);
    if (numMatch && Number(numMatch[0]) > 0 && Number(numMatch[0]) <= 9999) {
      return valid(`Passed Duration Validation for ${label}`);
    }
  }
  if (/^\d+\s*$/.test(v)) return review(`${label} is numeric only — unit missing`, 'duration_unit_review');
  return reject(`${label} must contain Days, Months, Years, or numeric duration`, 'duration_invalid');
}

export function validateStrictCompletionPeriodValue(value: string): StrictValueValidationResult {
  return validateDurationValue(value, 'Completion Period');
}

export function validateStrictGstValue(value: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('GST value is empty', 'gst_empty');
  if (isParagraphOrClauseText(v)) return reject('GST value is paragraph text', 'gst_prose');
  const gstin = extractGstin(v);
  if (gstin && GSTIN_RX.test(gstin)) return valid('Passed GST Validation — valid GSTIN format');
  if (/\bgst\b/i.test(v) && v.length > 80) return reject('GST value is narrative text — not GSTIN', 'gst_narrative');
  return reject('GST must match GSTIN format (e.g. 27ABCDE1234F1Z5)', 'gst_invalid_format');
}

export function validateStrictPanValue(value: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('PAN value is empty', 'pan_empty');
  if (isHeadingText(v)) return reject('PAN value is a heading', 'pan_heading');
  if (isParagraphOrClauseText(v)) return reject('PAN value is description or paragraph', 'pan_prose');
  const pan = extractPan(v);
  if (pan && PAN_RX.test(pan)) return valid('Passed PAN Validation — valid PAN format');
  return reject('PAN must match format ABCDE1234F', 'pan_invalid_format');
}

export function validateStrictPercentageValue(value: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('Percentage value is empty', 'percentage_empty');
  if (isParagraphOrClauseText(v)) return reject('Percentage value is narrative text', 'percentage_prose');
  if (/%/.test(v) && /\d/.test(v)) return valid('Passed Percentage Validation');
  if (/\d+\s*(?:percent|pct)\b/i.test(v)) return valid('Passed Percentage Validation');
  if (/\d+/.test(v)) return review('Percentage missing % symbol — needs review', 'percentage_review');
  return reject('Percentage must contain % or numeric percentage', 'percentage_invalid');
}

export function validateStrictExperienceValue(value: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('Experience value is empty', 'experience_empty');
  if (EXPERIENCE_HEADING_RX.test(v)) return reject('Experience value is a heading or index entry', 'experience_heading');
  if (isHeadingText(v)) return reject('Experience value is a heading', 'experience_heading');
  if (isParagraphOrClauseText(v) && v.length > 120) {
    return reject('Experience value is index or table-of-contents content', 'experience_toc');
  }
  if (
    /\b(years?|works?|projects?|contracts?|completed|similar\s+work|work\s+orders?|certificates?)\b/i.test(v) &&
    v.length >= 8
  ) {
    return valid('Passed Experience Validation');
  }
  if (/\d/.test(v) && v.length >= 4) return review('Experience criteria needs review', 'experience_review');
  return reject('Experience must contain Years, Works, Projects, or Completed Contracts criteria', 'experience_invalid');
}

export function validateStrictScopeValue(value: string): StrictValueValidationResult {
  const v = value.trim();
  if (!v) return reject('Scope value is empty', 'scope_empty');
  if (SCOPE_HEADING_RX.test(v)) return reject('Scope value is a heading or single word', 'scope_heading');
  if (DATE_SECTION_NAME_RX.test(v)) return reject('Scope value is a section name', 'scope_section_name');
  if (/^section\s+\d+/i.test(v)) return reject('Scope value is a clause number', 'scope_clause');
  if (NAVIGATION_RX.test(v)) return reject('Scope value is navigation content', 'scope_navigation');
  if (v.split(/\s+/).length <= 2 && v.length < 20) {
    return reject('Scope value is too short — not a business description', 'scope_too_short');
  }
  if (/^&\s*\w+$/i.test(v)) return reject('Scope value is broken OCR fragment', 'scope_broken');
  if (isParagraphOrClauseText(v) && v.length > 350) {
    return review('Scope value is long — needs review', 'scope_long_review');
  }
  if (v.length >= 12 && /\b(work|service|supply|deployment|maintenance|operation|provide|including|shall\s+include)\b/i.test(v)) {
    return valid('Passed Scope Validation — business description');
  }
  if (v.length >= 20 && v.split(/\s+/).length >= 4) {
    return valid('Passed Scope Validation');
  }
  return review('Scope description needs review', 'scope_review');
}

export function validateStrictParameterValue(
  kind: StrictValueParameterKind,
  value: string,
  context = ''
): StrictValueValidationResult {
  switch (kind) {
    case 'emd':
      return validateStrictEmdValue(value);
    case 'tender_value':
      return validateStrictTenderValueValue(value, context);
    case 'financial_amount':
      return validateFinancialAmount(value, 'Financial Amount');
    case 'bid_date':
      return validateStrictBidDateValue(value);
    case 'completion_period':
      return validateStrictCompletionPeriodValue(value);
    case 'duration':
      return validateDurationValue(value, 'Duration');
    case 'gst':
      return validateStrictGstValue(value);
    case 'pan':
      return validateStrictPanValue(value);
    case 'percentage':
      return validateStrictPercentageValue(value);
    case 'experience':
      return validateStrictExperienceValue(value);
    case 'scope':
      return validateStrictScopeValue(value);
    default:
      return review('No strict rule for parameter kind', 'strict_unknown');
  }
}

export function validateStrictParameterRow(
  canonicalKey: string | undefined,
  parameter: string,
  value: string,
  context = ''
): StrictValueValidationResult | null {
  const kind = resolveStrictParameterKind(canonicalKey, parameter);
  if (!kind) return null;
  return validateStrictParameterValue(kind, value, context);
}

export function getStrictValueValidationRuleSummary() {
  return {
    layer: 'enterprise_value_validation',
    outcomes: ['VALID', 'REVIEW', 'REJECT'] as StrictValidationStatus[],
    masterDatasetPolicy: 'Store VALID and REVIEW. Reject REJECT.',
    confidenceFactors: {
      pagePriorityMatch: 30,
      sectionMatch: 25,
      aliasMatch: 15,
      formatValidation: 20,
      tenderTypeMatch: 10,
    },
    rules: {
      financial: {
        parameters: ['Tender Value', 'EMD', 'Tender Fee', 'Security Deposit', 'Performance Security', 'Bank Guarantee'],
        mustContain: ['₹', 'Rs', 'INR', 'Lakh', 'Crore', 'Numeric Amount'],
        reject: ['Paragraphs', 'Clause Text', 'Headings', 'Annexure References', 'Navigation Text'],
      },
      dates: {
        parameters: ['Publishing Date', 'Bid Start', 'Bid End', 'Technical Opening', 'Financial Opening', 'Pre-Bid Meeting'],
        accept: ['DD-MM-YYYY', 'DD/MM/YYYY', 'DD-MMM-YYYY'],
        reject: ['Technical', 'Financial', 'Eligibility', 'Section Names', 'Broken Dates', 'Partial Dates'],
      },
      duration: {
        parameters: ['Completion Period', 'Contract Period', 'Bid Validity', 'Warranty Period'],
        mustContain: ['Days', 'Months', 'Years', 'Numeric Duration'],
        reject: ['Broken OCR', 'Section Names'],
      },
      gst: { format: '27ABCDE1234F1Z5', reject: ['Paragraphs', 'Random Text'] },
      pan: { format: 'ABCDE1234F', reject: ['Descriptions', 'Headings'] },
      percentage: { mustContain: ['%'], reject: ['Narrative Text'] },
      experience: { mustContain: ['Years', 'Works', 'Projects', 'Contracts'], reject: ['Headings', 'TOC'] },
      scope: { accept: ['Business Description'], reject: ['Single Words', 'Headings', '& Location', 'Section Numbers'] },
    },
  };
}
