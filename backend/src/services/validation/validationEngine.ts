import { parseAmount } from '../../utils/parseAmount';
import { ValidationField, ValidationResult } from '../../types/validation';

const EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

// India-focused, but permissive enough for enterprise data:
// - Accepts +91, 0 prefix, spaces/dashes
// - Validates to 10-digit mobile after normalization when possible
const PHONE_CHARS = /[^\d+]/g;

const TENDER_ID =
  /\b[A-Z]{2,}[A-Z0-9]*(?:[/\-_.][A-Z0-9]+)+\b|\b\d{4,}[/-]\d{2,}[/-][A-Z0-9/\-_.]+\b/i;

function ok(field: ValidationField, value: string): ValidationResult {
  return { field, value, valid: true, reason: '' };
}

function fail(field: ValidationField, value: string, reason: string): ValidationResult {
  return { field, value, valid: false, reason };
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isValidYmd(y: number, m: number, d: number) {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function normalizeDateToYmd(raw: string): { ymd: string | null; reason?: string } {
  const t = String(raw || '').trim();
  if (!t) return { ymd: null, reason: 'Empty date' };

  // Accept ISO already
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!isValidYmd(y, m, d)) return { ymd: null, reason: 'Invalid ISO date' };
    return { ymd: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  // Common formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, also allow 2-digit year.
  const dmY = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (dmY) {
    let d = Number(dmY[1]);
    let m = Number(dmY[2]);
    let y = Number(dmY[3]);
    if (y < 100) y = y >= 70 ? 1900 + y : 2000 + y;
    // Prefer DD/MM/YYYY (India). If looks like MM/DD/YYYY (month>12) swap.
    if (m > 12 && d <= 12) {
      const tmp = d;
      d = m;
      m = tmp;
    }
    if (!isValidYmd(y, m, d)) return { ymd: null, reason: 'Invalid date value' };
    return { ymd: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  // Month-name formats: 01 Jan 2026 / 1 January 2026
  const monthMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  const mname = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/);
  if (mname) {
    const d = Number(mname[1]);
    const mKey = mname[2].toLowerCase();
    let y = Number(mname[3]);
    if (y < 100) y = y >= 70 ? 1900 + y : 2000 + y;
    const m = monthMap[mKey];
    if (!m) return { ymd: null, reason: 'Unknown month name' };
    if (!isValidYmd(y, m, d)) return { ymd: null, reason: 'Invalid date value' };
    return { ymd: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  return { ymd: null, reason: 'Unrecognized date format' };
}

function normalizeCurrencyToNumeric(raw: string): { numeric: string | null; reason?: string } {
  const t = String(raw || '').trim();
  if (!t) return { numeric: null, reason: 'Empty currency' };

  if (/^(?:nil|na|n\/a|not applicable|exempt(?:ed)?)$/i.test(t)) {
    return { numeric: '0' };
  }

  const amount = parseAmount(t);
  if (!amount || Number.isNaN(amount) || amount < 0) {
    return { numeric: null, reason: 'Not a valid currency amount' };
  }

  // Store as plain numeric string (rupees) — production safe for downstream math.
  return { numeric: String(Math.round(amount)) };
}

function normalizePhone(raw: string): { normalized: string | null; reason?: string } {
  const t = String(raw || '').trim();
  if (!t) return { normalized: null, reason: 'Empty phone' };

  const cleaned = t.replace(PHONE_CHARS, '').replace(PHONE_CHARS, '');
  const digitsOnly = cleaned.replace(/[^\d]/g, '');

  // Try to reduce to a 10-digit Indian mobile number.
  let ten = digitsOnly;
  if (ten.length > 10) {
    // Strip country code or leading zeros
    if (ten.startsWith('91') && ten.length >= 12) ten = ten.slice(-10);
    else ten = ten.slice(-10);
  }

  if (ten.length !== 10) return { normalized: null, reason: 'Phone must be 10 digits after normalization' };
  if (!/^[6-9]\d{9}$/.test(ten)) return { normalized: null, reason: 'Invalid Indian mobile number format' };
  return { normalized: ten };
}

function normalizeTenderNumber(raw: string): { normalized: string | null; reason?: string } {
  const t = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!t) return { normalized: null, reason: 'Empty tender number' };

  const m = t.match(TENDER_ID) || t.match(/[A-Z0-9][A-Z0-9/\-_.]{4,50}/i);
  if (!m) return { normalized: null, reason: 'Does not match tender id pattern' };

  const id = m[0].trim();
  if (!/[A-Za-z]/.test(id) || !/\d/.test(id)) return { normalized: null, reason: 'Tender number must include letters and digits' };
  return { normalized: id };
}

export class ValidationEngine {
  validate(field: ValidationField, rawValue: string): ValidationResult {
    switch (field) {
      case 'date': {
        const { ymd, reason } = normalizeDateToYmd(rawValue);
        if (!ymd) return fail(field, String(rawValue || ''), reason || 'Invalid date');
        return ok(field, ymd);
      }
      case 'currency': {
        const { numeric, reason } = normalizeCurrencyToNumeric(rawValue);
        if (numeric == null) return fail(field, String(rawValue || ''), reason || 'Invalid currency');
        return ok(field, numeric);
      }
      case 'email': {
        const t = String(rawValue || '').trim();
        if (!t) return fail(field, t, 'Empty email');
        if (!EMAIL.test(t)) return fail(field, t, 'Invalid email format');
        return ok(field, t.toLowerCase());
      }
      case 'phone': {
        const { normalized, reason } = normalizePhone(rawValue);
        if (!normalized) return fail(field, String(rawValue || ''), reason || 'Invalid phone');
        return ok(field, normalized);
      }
      case 'tenderNumber': {
        const { normalized, reason } = normalizeTenderNumber(rawValue);
        if (!normalized) return fail(field, String(rawValue || ''), reason || 'Invalid tender number');
        return ok(field, normalized);
      }
      default:
        return fail(field, String(rawValue || ''), 'Unknown field type');
    }
  }
}

export const validationEngine = new ValidationEngine();

