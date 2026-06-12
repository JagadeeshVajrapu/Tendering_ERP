import { MasterDatasetKey } from '../../types/masterDataset';

/** Documented validation rules (reject invalid values before storage). */
export const PARAMETER_VALIDATION_RULES = {
  tenderValue: {
    mustBeCurrency: true,
    nearLabels: [
      'Estimated Tender Value',
      'Tender Value',
      'Project Cost',
      'Estimated Cost',
      'Contract Value',
    ],
    forbiddenNear: ['Turnover', 'Experience', 'Bank Solvency'],
  },
  emdAmount: {
    nearLabels: ['EMD', 'Earnest Money Deposit', 'Bid Security', 'Earnest Money'],
  },
  dates: {
    description: 'Must match valid date formats (DD-MM-YYYY, DD/MM/YYYY, DD Mon YYYY, etc.)',
  },
  completionPeriod: {
    description: 'Must contain a numeric value (e.g. 12, 6 months, 90 days)',
  },
} as const;

export const DATE_PARAMETER_KEYS = new Set<MasterDatasetKey>([
  'publishingDate',
  'preBidMeetingDate',
  'bidStartDate',
  'bidEndDate',
  'technicalBidDate',
  'financialBidDate',
]);

export const CURRENCY_PARAMETER_KEYS = new Set<MasterDatasetKey>([
  'tenderValue',
  'emdAmount',
  'documentFee',
  'performanceSecurity',
  'bankGuarantee',
  'turnoverRequirement',
  'netWorthRequirement',
  'bidCapacity',
]);

export const PERIOD_PARAMETER_KEYS = new Set<MasterDatasetKey>(['completionPeriod', 'contractPeriod']);

const TENDER_VALUE_NEAR_RX =
  /\b(estimated\s+tender\s+value|tender\s+value|project\s+cost|estimated\s+cost|contract\s+value)\b/i;

const TENDER_VALUE_FORBIDDEN_RX = /\b(turnover|experience|bank\s+solvency)\b/i;

const EMD_NEAR_RX = /\b(emd|earnest\s+money(\s+deposit)?|bid\s+security(\s+amount)?)\b/i;

const CURRENCY_PREFIX_RX = /(?:₹|rs\.?\s*|inr\b|rupees?\b|\$|€|£)/i;

const CURRENCY_UNIT_RX = /\b\d+(?:\.\d+)?\s*(?:lakh|lac|crore|cr|thousand|k)\b/i;

/** Indian-style grouped amounts: 5,00,000 or 33,59,315 */
const COMMA_CURRENCY_RX = /\d{1,3}(?:,\d{2,3})+/;

const DATE_VALUE_RX =
  /\b(?:\d{1,2}[\s./-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s./-]\d{2,4}|\d{1,2}[\s./-]\d{1,2}[\s./-]\d{2,4}|\d{4}[\s./-]\d{1,2}[\s./-]\d{1,2}|\d{1,2}:\d{2}\s*(?:am|pm)?\s+\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i;

const AMOUNT_VALUE_RX =
  /(?:₹|rs\.?|inr|\$|€|£)?\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+(?:\.\d{1,2})?\s*(?:lakh|lac|crore|cr|thousand|k)\b/i;

export function isCurrencyValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  const hasCurrencyMarker =
    CURRENCY_PREFIX_RX.test(v) || CURRENCY_UNIT_RX.test(v) || COMMA_CURRENCY_RX.test(v);
  if (!hasCurrencyMarker) return false;

  const digits = v.replace(/[^\d]/g, '');
  return digits.length >= 2;
}

export function isValidAmountValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (!AMOUNT_VALUE_RX.test(v)) return false;
  const digits = v.replace(/[^\d]/g, '');
  return digits.length >= 2;
}

export function isValidDateValue(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 120) return false;
  if (!DATE_VALUE_RX.test(v)) return false;

  const yearMatch = v.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = Number(yearMatch[0]);
    if (year < 1990 || year > 2100) return false;
  }

  const dayMonth = v.match(/\b(\d{1,2})[\s./-](\d{1,2})[\s./-](\d{2,4})\b/);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = Number(dayMonth[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return false;
  }

  return true;
}

export function isNumericPeriodValue(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 80) return false;
  if (/^[a-zA-Z\s]+$/.test(v)) return false;

  const digitMatch = v.match(/\d+/);
  if (!digitMatch) return false;

  const num = Number(digitMatch[0]);
  return Number.isFinite(num) && num > 0 && num <= 9999;
}

export function hasTenderValueNearContext(context: string): boolean {
  return TENDER_VALUE_NEAR_RX.test(context);
}

export function hasForbiddenTenderValueContext(context: string): boolean {
  return TENDER_VALUE_FORBIDDEN_RX.test(context);
}

export function hasEmdNearContext(context: string): boolean {
  return EMD_NEAR_RX.test(context);
}
