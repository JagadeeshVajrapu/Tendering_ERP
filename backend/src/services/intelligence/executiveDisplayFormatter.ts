import { ExtractedProductionField } from './extractedProductionField';
import { VERIFICATION_STORE_THRESHOLD } from './fieldVerificationPipeline';
import { validateFieldDictionary, isDisplayableByDictionary } from './fieldDictionaryEngine';

const PARAGRAPH_MARKERS =
  /\b(?:the bidder shall|hereinafter|notwithstanding|as per nit|refer annexure|section\s+\d)/i;
const MAX_WORDS: Record<string, number> = {
  default: 14,
  tenderName: 12,
  scopeOfWork: 18,
  eligibility: 10,
  technical: 12,
  statutory: 8,
};

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Reject values unsuitable for executive NIT display. */
export function isDisplayableExecutiveValue(value: string, fieldId = 'default'): boolean {
  const v = value.trim();
  if (!v || v.length < 2) return false;
  if (/^(?:not found|unknown|n\/a|nil|—|-)$/i.test(v)) return false;
  if (PARAGRAPH_MARKERS.test(v)) return false;

  const maxW = MAX_WORDS[fieldId] ?? MAX_WORDS.default;
  if (wordCount(v) > maxW) return false;
  if (v.length > 120 && !['scopeOfWork'].includes(fieldId)) return false;

  if (!isDisplayableByDictionary(fieldId, v)) return false;

  return true;
}

/** Normalize money for executive display (₹2.5 Cr, ₹5 Lakh). */
export function formatExecutiveMoney(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  const m = t.match(
    /(?:₹|rs\.?\s*|inr\s*)?([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|lac|thousand|k)?/i
  );
  if (!m) return t.slice(0, 40);

  const num = parseFloat(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();

  if (/crore|cr/i.test(unit) || (num >= 1 && num < 1000 && /crore|cr/i.test(t))) {
    const n = /crore|cr/i.test(t) ? num : num;
    return `₹${n} Cr`;
  }
  if (/lakh|lac/i.test(unit) || /lakh|lac/i.test(t)) {
    return `₹${num} Lakh`;
  }
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (num >= 100000) return `₹${Math.round(num / 100000)} Lakh`;

  const prefix = t.includes('₹') || /rs\.?/i.test(t) ? '₹' : '₹';
  return `${prefix}${m[1]}${unit ? ` ${unit.charAt(0).toUpperCase() + unit.slice(1)}` : ''}`.trim();
}

export function formatExecutiveDate(raw: string): string {
  const m = raw.match(
    /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}/i
  );
  if (!m) return raw.slice(0, 30);
  const d = m[0];
  const parts = d.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (parts) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const mi = parseInt(parts[2], 10) - 1;
    if (mi >= 0 && mi < 12) {
      return `${parts[1]} ${months[mi]} ${parts[3].length === 2 ? '20' + parts[3] : parts[3]}`;
    }
  }
  return d;
}

export function formatExecutiveDuration(raw: string): string {
  const m = raw.match(/(\d+)\s*(days?|months?|years?|weeks?)/i);
  if (m) {
    const n = m[1];
    const u = m[2].toLowerCase();
    const label = u.startsWith('day')
      ? 'Days'
      : u.startsWith('month')
        ? 'Months'
        : u.startsWith('year')
          ? 'Years'
          : 'Weeks';
    return `${n} ${label}`;
  }
  if (wordCount(raw) <= 6) return raw.trim();
  return null as unknown as string;
}

export function formatYesNoFromText(text: string): 'Yes' | 'No' | null {
  const t = text.toLowerCase();
  if (/\b(?:not\s+applicable|no\s+reverse|reverse\s+auction\s*:\s*no|without\s+reverse)\b/.test(t)) {
    return 'No';
  }
  if (/\b(?:reverse\s+auction|e-?reverse\s+auction|online\s+auction)\b/.test(t)) {
    return 'Yes';
  }
  return null;
}

export function formatExecutiveFieldValue(fieldId: string, raw: string, context = ''): string | null {
  const dict = validateFieldDictionary(fieldId, raw, context);
  if (!dict.valid || !dict.normalizedValue) return null;

  let v = dict.normalizedValue.replace(/\s+/g, ' ').trim();
  if (!isDisplayableExecutiveValue(v, fieldId)) return null;

  if (['emdAmount', 'tenderFee', 'estimatedTenderValue', 'performanceSecurity', 'bidSecurityAmount'].includes(fieldId)) {
    return formatExecutiveMoney(v);
  }

  if (fieldId.includes('Date')) {
    return formatExecutiveDate(v);
  }

  if (fieldId === 'contractDuration') {
    const d = formatExecutiveDuration(v);
    return d || (wordCount(v) <= 8 ? v : null);
  }

  if (fieldId === 'submissionMode' || fieldId === 'bidSystem') {
    return v;
  }

  if (fieldId === 'reverseAuction' || fieldId === 'mafRequired') {
    if (/^yes$/i.test(v)) return 'Yes';
    if (/^no$/i.test(v)) return 'No';
    return formatYesNoFromText(v);
  }

  if (fieldId === 'bankGuarantee') {
    if (/^(yes|required|applicable)$/i.test(v)) return 'Yes';
    if (/^(no|not required|nil|na)$/i.test(v)) return 'No';
    if (/%/.test(v) || /₹|rs/i.test(v)) return formatExecutiveMoney(v);
    return v.length <= 40 ? v : 'Yes';
  }

  if (['gstRequirement', 'epfRequirement', 'esiRequirement', 'labourLicense'].includes(fieldId)) {
    if (/gst/i.test(v)) return v.length > 40 ? 'GST Registration' : v.replace(/registration.*/i, 'Registration').slice(0, 40);
    if (/epf/i.test(v)) return 'EPF Registration';
    if (/esi/i.test(v)) return 'ESI Registration';
    if (/labou?r/i.test(v)) return 'Labour License';
  }

  return v;
}

export function getVerifiedFieldValue(
  fields: ExtractedProductionField[],
  ids: string[]
): { value: string; fieldId: string } | null {
  for (const id of ids) {
    const f = fields.find((x) => x.id === id);
    if (!f?.validated || !f.value || f.confidence < VERIFICATION_STORE_THRESHOLD) continue;
    const raw = Array.isArray(f.value) ? f.value.join(', ') : String(f.value);
    const formatted = formatExecutiveFieldValue(id, raw, f.sourceText || '');
    if (formatted) return { value: formatted, fieldId: id };
  }
  return null;
}

export function combineCorpus(fields: ExtractedProductionField[]): string {
  return fields
    .map((f) => [f.sourceText, Array.isArray(f.value) ? f.value.join(' ') : f.value].filter(Boolean).join(' '))
    .join('\n');
}
