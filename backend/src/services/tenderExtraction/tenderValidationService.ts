import { IExtractedField } from '../../models/TenderExtraction';

function normalizeCurrency(value: string): string | null {
  const v = value.replace(/[₹,]/g, ' ').replace(/\s+/g, ' ').trim();
  const m = v.match(/(\d+(?:\.\d+)?)(?:\s*(?:lakh|lac|crore))?/i);
  if (!m) return null;
  return m[1];
}

function normalizeEmail(value: string): string | null {
  const m = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

function normalizeDate(value: string): string | null {
  const v = value.trim();
  const iso = v.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = v.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dmy) {
    const dd = String(dmy[1]).padStart(2, '0');
    const mm = String(dmy[2]).padStart(2, '0');
    const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yy}-${mm}-${dd}`;
  }

  return null;
}

function normalizeTenderId(value: string): string | null {
  const v = value.trim();
  const m = v.match(/[A-Z0-9][A-Z0-9\/\-\.\:]{3,}/i);
  return m ? m[0] : null;
}

function isDateField(name: string) {
  return /Date$/i.test(name);
}

function isCurrencyField(name: string) {
  return /(Value|Cost|Amount|Fee)$/i.test(name);
}

class TenderValidationService {
  validateAndNormalize(fields: IExtractedField[]): IExtractedField[] {
    return fields
      .map((f) => {
        let normalizedValue: string | undefined;

        if (isDateField(f.fieldName)) {
          normalizedValue = normalizeDate(f.value) || undefined;
          if (!normalizedValue) return null;
        } else if (isCurrencyField(f.fieldName)) {
          normalizedValue = normalizeCurrency(f.value) || undefined;
          if (!normalizedValue) return null;
        } else if (/Email/i.test(f.fieldName)) {
          normalizedValue = normalizeEmail(f.value) || undefined;
          if (!normalizedValue) return null;
        } else if (/Phone/i.test(f.fieldName)) {
          normalizedValue = normalizePhone(f.value) || undefined;
          if (!normalizedValue) return null;
        } else if (/(Tender Number|NIT Number)/i.test(f.fieldName)) {
          normalizedValue = normalizeTenderId(f.value) || undefined;
          if (!normalizedValue) return null;
        }

        const value = normalizedValue || f.value.trim();
        return { ...f, value, normalizedValue };
      })
      .filter(Boolean) as IExtractedField[];
  }
}

export const fieldValidationService = new TenderValidationService();

