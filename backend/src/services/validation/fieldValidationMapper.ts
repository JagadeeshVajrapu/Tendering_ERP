import { ValidationField } from '../../types/validation';
import { FieldValidationRecord } from '../../types/fieldValidation';
import { validationEngine } from './validationEngine';

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_IN_TEXT = /(?:\+91[\s-]?)?[6-9]\d{9}\b|\b0?[6-9]\d{9}\b/;

export function inferValidationType(fieldName: string, rawValue: string): ValidationField | null {
  const name = fieldName.toLowerCase();
  const value = String(rawValue || '').trim();

  if (/tender number|nit number|tender no|tender id|bid reference/i.test(name)) {
    return 'tenderNumber';
  }
  if (/date|bid dates|schedule|meeting|opening|submission|publish|closing|due/i.test(name)) {
    return 'date';
  }
  if (/emd|tender value|tender fee|amount|turnover|cost|fee|security|deposit|value/i.test(name)) {
    if (/@/.test(value)) return null;
    return 'currency';
  }
  if (/email|e-mail|mail/i.test(name) || EMAIL_IN_TEXT.test(value)) {
    return 'email';
  }
  if (/phone|mobile|contact|telephone|fax/i.test(name) || PHONE_IN_TEXT.test(value)) {
    return 'phone';
  }

  return null;
}

function extractEmail(raw: string): string {
  const m = raw.match(EMAIL_IN_TEXT);
  return m ? m[0] : raw.trim();
}

function extractPhone(raw: string): string {
  const m = raw.match(PHONE_IN_TEXT);
  return m ? m[0] : raw.trim();
}

function validateDateValue(fieldName: string, raw: string): FieldValidationRecord {
  const value = String(raw || '').trim();
  if (!value) {
    return { fieldName, value: '', valid: false, reason: 'Empty date', rawValue: raw, validationType: 'date' };
  }

  if (fieldName === 'Bid Dates' && value.includes('|')) {
    const segments = value.split('|').map((s) => s.trim()).filter(Boolean);
    const normalized: string[] = [];
    const failures: string[] = [];

    for (const segment of segments) {
      const datePart = segment.replace(/^[^:]+:\s*/, '').trim() || segment;
      const result = validationEngine.validate('date', datePart);
      if (result.valid) normalized.push(result.value);
      else failures.push(result.reason || 'Invalid date segment');
    }

    if (normalized.length) {
      return {
        fieldName,
        value: normalized.join(' | '),
        valid: true,
        reason: failures.length ? `Partial: ${failures.join('; ')}` : '',
        rawValue: raw,
        validationType: 'date',
      };
    }

    return {
      fieldName,
      value: raw,
      valid: false,
      reason: failures[0] || 'No valid dates in bid schedule',
      rawValue: raw,
      validationType: 'date',
    };
  }

  const datePart = value.replace(/^[^:]+:\s*/, '').trim() || value;
  const result = validationEngine.validate('date', datePart);
  return {
    fieldName,
    value: result.valid ? result.value : raw,
    valid: result.valid,
    reason: result.reason,
    rawValue: raw,
    validationType: 'date',
  };
}

export function validateFieldValue(fieldName: string, rawValue: string): FieldValidationRecord | null {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { fieldName, value: '', valid: false, reason: 'Empty value', rawValue: raw };
  }

  const type = inferValidationType(fieldName, raw);
  if (!type) return null;

  if (type === 'date') {
    return validateDateValue(fieldName, raw);
  }

  const input =
    type === 'email' ? extractEmail(raw) : type === 'phone' ? extractPhone(raw) : raw;

  const result = validationEngine.validate(type, input);
  return {
    fieldName,
    value: result.valid ? result.value : raw,
    valid: result.valid,
    reason: result.reason,
    rawValue: raw,
    validationType: type,
  };
}

export function validateExtractedFields(
  fields: Array<{ fieldName: string; extractedValue: string }>
): FieldValidationRecord[] {
  const records: FieldValidationRecord[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    const record = validateFieldValue(field.fieldName, field.extractedValue);
    if (!record) continue;
    const key = record.fieldName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    records.push(record);
  }

  return records.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
}

/** Scan candidate values for contact fields not captured by rule extraction. */
export function enrichWithContactCandidates(
  records: FieldValidationRecord[],
  candidates: Array<{ fieldName: string; candidateValue: string }>
): FieldValidationRecord[] {
  const out = [...records];
  const seen = new Set(records.map((r) => r.fieldName.toLowerCase()));

  for (const c of candidates) {
    const val = String(c.candidateValue || '').trim();
    if (!val) continue;

    if (!seen.has('contact email') && EMAIL_IN_TEXT.test(val)) {
      const record = validateFieldValue('Contact Email', val);
      if (record) {
        out.push(record);
        seen.add('contact email');
      }
    }

    if (!seen.has('contact phone') && PHONE_IN_TEXT.test(val)) {
      const record = validateFieldValue('Contact Phone', val);
      if (record) {
        out.push(record);
        seen.add('contact phone');
      }
    }
  }

  return out.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
}
