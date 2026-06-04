import { FieldLocatorFieldName } from '../../types/fieldLocator';

/** Pages 1–5 searched before remaining pages (all pages are searched). */
export const FIELD_LOCATOR_PRIORITY_PAGES = 5;

export const FIELD_LOCATOR_FIELD_ORDER: FieldLocatorFieldName[] = [
  'Tender Number',
  'Organization',
  'EMD',
  'Tender Value',
  'Name of Work',
];

/** Tolerant tender ID pattern (OCR spacing around slashes and dashes). */
export const TENDER_NUMBER_REGEX =
  /[0-9]+\s*\/\s*[A-Za-z0-9][A-Za-z0-9\s\/]*\/[A-Za-z0-9]+\s*\/\s*[0-9]{4}\s*-\s*[0-9]{2}\s*\/\s*[A-Za-z0-9\-]+/gi;

export const TENDER_NUMBER_LABEL_REGEX = [
  '(?:Tender\\s*(?:No\\.?|Number|ID)|NIT\\s*(?:No\\.?|Number))\\s*[:\\-–]\\s*([0-9]+\\s*\\/\\s*[A-Za-z0-9][A-Za-z0-9\\s\\/\\-]+)',
  TENDER_NUMBER_REGEX.source,
];

export const TENDER_NUMBER_KEYWORDS = ['Tender Number', 'Tender No', 'Tender No.', 'NIT Number'];
export const TENDER_NUMBER_ALIASES = [
  'NIT No',
  'Bid Reference No',
  'Reference No',
  'Tender ID',
  'Ref No',
];

export const ORGANIZATION_MARKERS = ['CSIR', 'CRRI', 'Central Road Research Institute'];
export const ORGANIZATION_REGEX = [
  '(CSIR)\\s*[-–]\\s*(Central\\s+Road\\s+Research\\s+Institute)',
  '(Central\\s+Road\\s+Research\\s+Institute)\\s*[,\\(]?\\s*(CRRI)',
  '(CSIR)\\s*[,\\(]?\\s*(CRRI)',
];
export const ORGANIZATION_KEYWORDS = ['Organization', 'Organisation', 'Issuing Authority'];
export const ORGANIZATION_ALIASES = [
  'Name of Organization',
  'Central Road Research Institute',
  'CSIR',
  'CRRI',
];

export const TENDER_VALUE_KEYWORDS = [
  'Estimated Cost',
  'Tender Value',
  'Contract Value',
  'Approximate Cost',
];
export const TENDER_VALUE_ALIASES = [
  'Estimated Tender Value',
  'Tender Amount',
  'Approximate Value',
  'Cost of Work',
];
export const TENDER_VALUE_MONEY_REGEX = /Rs\.?\s?[0-9,]+(?:\.[0-9]+)?/gi;

export const EMD_KEYWORDS = ['EMD', 'Earnest Money Deposit'];
export const EMD_ALIASES = ['Earnest Money', 'Bid Security', 'EMD Amount', 'Amount of EMD'];
export const EMD_REGEX = [
  '(?:EMD|Earnest\\s+Money(?:\\s+Deposit)?|Bid\\s+Security)\\s*[:\\-–]?\\s*([^\\n|]{2,120})',
  '(?:EMD|Earnest\\s+Money)\\s*[:\\-–]?\\s*((?:Rs\\.?|INR|₹)\\s*[\\d,]+(?:\\.\\d+)?[^\\n|]{0,40})',
];
export const EMD_MONEY_REGEX = /Rs\.?\s?[0-9,]+(?:\.[0-9]+)?/gi;

export const WORK_KEYWORDS = ['Name of Work', 'Work Name'];
export const WORK_ALIASES = ['Work Title', 'Title of Work', 'Subject', 'Description of Work'];
export const WORK_REGEX = [
  '(?:Name\\s+of\\s+Work|Work\\s*Name|Work\\s+Title|Subject)\\s*[:\\-–]\\s*([^\\n|]{8,140})',
];
