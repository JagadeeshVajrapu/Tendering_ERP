import { ProductionFieldDefinition } from './fieldDefinitions';
import { validateFieldDictionary } from './fieldDictionaryEngine';

export interface NormalizationResult {
  normalized: string | null;
  rejected: boolean;
  rejectReason?: string;
  formatScore: number;
  isFragment: boolean;
}

const FRAGMENT_PATTERNS = [
  /\b(?:should|shall|must|will|may)\s+be\s*$/i,
  /\b(?:should|shall|must)\s+be\s+(?:at\s+least|minimum|more\s+than)/i,
  /^(?:financial|minimum|average|annual)\s+(?:turnover|requirement)\s+should\b/i,
  /\bon\s+the\s+same\s+terms/i,
  /\bterms\s+and\s+conditions\b/i,
  /\bthe\s+bidder\s+shall\b/i,
  /\bhereinafter\b/i,
  /\bas\s+per\s+(?:nit|tender)\b/i,
  /^(?:refer|see)\s+annexure/i,
  /^section\s+\d/i,
  /^\d+(\.\d+){2,}\s*$/,
];

const INCOMPLETE_ENDINGS =
  /\b(?:should|shall|must|will|to|of|for|in|at|by|with|and|or|the|a|an|is|are|be|have|has)\s*$/i;

const SECTION_NUMBER_ONLY = /^(?:clause|section|schedule|annexure|appendix)\s*[\d.]+[a-z]?$/i;

const MONEY_VALUE =
  /(?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d+)?\s*(?:\/-)?(?:\s*(?:lakh|lac|crore|cr|million|thousand))?/i;

const TENDER_ID =
  /\b[A-Z]{2,}[A-Z0-9]*(?:[/\-_.][A-Z0-9]+)+\b|\b\d{4,}[/-]\d{2,}[/-][A-Z0-9/\-_.]+\b/i;

const DURATION_VALUE =
  /\b\d+\s*(?:years?|yrs?|months?|mos?|weeks?|days?)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*\(?\d*\)?\s*(?:years?|months?)\b/i;

const WORD_COUNT = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function stripLabelPrefix(raw: string, labels: string[]): string {
  let t = raw.trim();
  for (const label of labels) {
    const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^:–-]{0,20}[:\\s]+`, 'i');
    t = t.replace(re, '').trim();
  }
  return t;
}

function isGenericFragment(value: string, fieldId: string): string | null {
  const v = value.trim();
  if (!v || v.length < 2) return 'Empty value';

  if (SECTION_NUMBER_ONLY.test(v)) return 'Section reference only';
  if (/^\d+(\.\d+)+$/.test(v)) return 'Clause number only';

  if (v.length <= 4 && fieldId !== 'tenderNumber') {
    if (!/\d/.test(v)) return 'Too short — likely fragment';
  }

  if (v.length <= 5 && fieldId === 'tenderNumber' && !/[A-Z0-9/\-_.]{4,}/i.test(v)) {
    return 'Not a valid tender reference format';
  }

  for (const p of FRAGMENT_PATTERNS) {
    if (p.test(v)) return 'Incomplete clause or boilerplate';
  }

  if (INCOMPLETE_ENDINGS.test(v)) return 'Incomplete sentence fragment';

  const words = WORD_COUNT(v);
  if (words > 25 && !['scopeOfWork', 'experienceRequirements', 'turnoverRequirements'].includes(fieldId)) {
    return 'Paragraph text — not a field value';
  }

  if (words > 12 && ['gstRequirement', 'epfRequirement', 'esiRequirement', 'labourLicense'].includes(fieldId)) {
    return 'Statutory field must be a short requirement, not a paragraph';
  }

  if (/^(?:tice|tend|emen|nit|refe)$/i.test(v)) return 'OCR or label fragment';

  if (/^[a-z]{2,6}$/i.test(v) && fieldId === 'tenderNumber') return 'Plain word — not tender number';

  if (/\b(?:minimum|average|annual)\s+(?:annual\s+)?turnover\s+should\b/i.test(v)) {
    return 'Label fragment without amount';
  }

  if (/\byear\s+on\s+the\s+same\b/i.test(v)) return 'Contract clause fragment, not duration';

  return null;
}

function normalizeTenderNumber(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ');
  const m = t.match(TENDER_ID) || t.match(/[A-Z0-9][A-Z0-9/\-_.]{4,50}/i);
  if (!m) return null;
  const id = m[0].trim();
  if (!/[A-Za-z]/i.test(id) || !/\d/.test(id)) return null;
  if (WORD_COUNT(id) > 8) return null;
  return id;
}

function normalizeDuration(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(DURATION_VALUE);
  if (m) return m[0].replace(/\s+/g, ' ');
  if (/\b(?:period|duration)\s+of\s+(\d+\s*\w+)/i.test(t)) {
    const g = t.match(/(\d+\s*(?:years?|months?|weeks?|days?))/i);
    if (g) return g[1];
  }
  return null;
}

function normalizeMoney(raw: string): string | null {
  const t = raw.trim();
  const m = t.match(MONEY_VALUE);
  if (m) {
    let out = m[0].replace(/\s+/g, ' ').trim();
    if (/\d+\s*%/.test(t) && !/%/.test(out)) {
      const pct = t.match(/\d+(?:\.\d+)?\s*%/);
      if (pct) out = pct[0];
    }
    return out;
  }
  const plainNum = t.match(/([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr|thousand|k)?/i);
  if (plainNum && /emd|fee|amount|value|security|deposit|rs/i.test(t)) {
    return plainNum[0].replace(/\s+/g, ' ').trim();
  }
  if (/^(?:nil|na|n\/a|not applicable|exempt(?:ed)?)$/i.test(t)) return t;
  return null;
}

function normalizeTurnover(raw: string): string | null {
  const t = stripLabelPrefix(raw, ['turnover', 'annual turnover', 'average turnover', 'minimum turnover']);
  if (isGenericFragment(t, 'turnoverRequirements')) return null;
  const money = normalizeMoney(t);
  if (money && /turnover|revenue|financial/i.test(t)) {
    return `${money}${/crore|lakh|lac|cr/i.test(t) ? '' : ''} ${/annual/i.test(t) ? 'Annual ' : ''}Turnover`.replace(/\s+/g, ' ').trim();
  }
  if (money && WORD_COUNT(t) <= 15) return `${money} Turnover`.trim();
  const years = t.match(/(?:last|past)\s+(\d+)\s+financial\s+years?/i);
  if (money && years) return `${money} (avg. over ${years[1]} years)`;
  return null;
}

function normalizeExperience(raw: string): string | null {
  const t = stripLabelPrefix(raw, ['experience', 'similar work', 'past experience']);
  if (isGenericFragment(t, 'experienceRequirements')) return null;
  if (/\d+\s*years?/i.test(t) || /similar\s+(?:work|nature)/i.test(t) || /completed.*(?:work|projects)/i.test(t)) {
    if (WORD_COUNT(t) > 40) {
      const first = t.split(/[.!?]/)[0]?.trim();
      return first && first.length >= 10 ? first.slice(0, 200) : null;
    }
    return t.slice(0, 250);
  }
  return null;
}

function normalizeStatutory(raw: string, keyword: string): string | null {
  const t = stripLabelPrefix(raw, [keyword]);
  if (isGenericFragment(t, 'gstRequirement')) return null;
  if (WORD_COUNT(t) > 18) return null;
  if (new RegExp(keyword, 'i').test(t) && /(?:valid|registered|registration|certificate)/i.test(t)) {
    return t.slice(0, 120);
  }
  if (/^(?:valid\s+)?(?:gst|epf|esi)/i.test(t) && t.length <= 80) return t;
  if (t.length >= 8 && t.length <= 100 && !/\bshall\b/i.test(t)) return t;
  return null;
}

function normalizeSubmissionMode(raw: string): string | null {
  const r = validateFieldDictionary('submissionMode', raw, '');
  return r.valid ? r.normalizedValue : null;
}

function normalizeWorkLocation(raw: string): string | null {
  const t = stripLabelPrefix(raw, ['work location', 'place of work', 'site of work', 'project location']);
  if (isGenericFragment(t, 'workLocation')) return null;
  if (WORD_COUNT(t) > 15 || /\bshall\b/i.test(t)) return null;
  if (t.length >= 3 && t.length <= 120) return t;
  return null;
}

function normalizeDate(raw: string): string | null {
  const t = raw.trim();
  if (
    /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(t) ||
    /\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t)
  ) {
    const m = t.match(
      /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?:\s+\d{1,2}:\d{2})?|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}/i
    );
    return m ? m[0] : null;
  }
  return null;
}

/** Field-specific format validation after normalization. */
export function validateNormalizedFormat(fieldId: string, value: string): { valid: boolean; formatScore: number } {
  const v = value.trim();
  if (!v) return { valid: false, formatScore: 0 };

  switch (fieldId) {
    case 'tenderNumber':
    case 'tenderReferenceNumber': {
      const valid =
        (TENDER_ID.test(v) || (/[A-Za-z]/i.test(v) && /\d/.test(v) && v.length >= 5)) &&
        WORD_COUNT(v) <= 8;
      return { valid, formatScore: valid ? 0.95 : 0.2 };
    }
    case 'tenderName':
    case 'organization':
    case 'department':
    case 'scopeOfWork': {
      const frag = isGenericFragment(v, fieldId);
      const minLen = fieldId === 'scopeOfWork' ? 15 : 8;
      const maxWords = fieldId === 'scopeOfWork' ? 80 : 40;
      const valid = v.length >= minLen && WORD_COUNT(v) <= maxWords && !frag;
      return { valid, formatScore: valid ? 0.86 : 0.2 };
    }
    case 'emdAmount':
    case 'tenderFee':
    case 'performanceSecurity':
    case 'bankGuarantee':
    case 'bidSecurityAmount':
    case 'estimatedTenderValue': {
      const valid = MONEY_VALUE.test(v) || /^\d+\s*%$/.test(v) || /^(?:nil|na|exempt)/i.test(v);
      return { valid, formatScore: valid ? 0.92 : 0.15 };
    }
    case 'contractDuration': {
      const valid = DURATION_VALUE.test(v) || /^\d+\s*(?:months?|years?|weeks?|days?)$/i.test(v);
      return { valid, formatScore: valid ? 0.93 : 0.1 };
    }
    case 'turnoverRequirements':
    case 'financialRequirements': {
      const valid =
        (MONEY_VALUE.test(v) || /\d+\s*(?:crore|lakh|lac|cr)/i.test(v)) &&
        /turnover|revenue|financial/i.test(v);
      const valid2 = MONEY_VALUE.test(v) && WORD_COUNT(v) <= 12;
      return { valid: valid || valid2, formatScore: valid || valid2 ? 0.9 : 0.2 };
    }
    case 'experienceRequirements': {
      const valid =
        /\d+\s*years?/i.test(v) ||
        /similar\s+(?:work|nature)/i.test(v) ||
        /completed/i.test(v);
      return { valid, formatScore: valid ? 0.88 : 0.15 };
    }
    case 'gstRequirement':
      return {
        valid: /gst/i.test(v) && WORD_COUNT(v) <= 12 && !/\bshall\s+have\b/i.test(v),
        formatScore: /gst/i.test(v) ? 0.85 : 0.1,
      };
    case 'epfRequirement':
      return {
        valid: /epf|provident/i.test(v) && WORD_COUNT(v) <= 12,
        formatScore: /epf|provident/i.test(v) ? 0.85 : 0.1,
      };
    case 'esiRequirement':
      return {
        valid: /esi|employees?\s+state/i.test(v) && WORD_COUNT(v) <= 12,
        formatScore: /esi/i.test(v) ? 0.85 : 0.1,
      };
    case 'bidSubmissionDate':
    case 'bidOpeningDate':
    case 'preBidMeetingDate':
      return { valid: !!normalizeDate(v), formatScore: normalizeDate(v) ? 0.92 : 0.1 };
    case 'submissionMode':
    case 'bidSystem': {
      const dict = validateFieldDictionary(fieldId, v, '');
      return { valid: dict.valid, formatScore: dict.valid ? 0.95 : 0.05 };
    }
    case 'workLocation':
      return {
        valid: v.length >= 3 && WORD_COUNT(v) <= 12 && !/\bonline\b/i.test(v),
        formatScore: 0.8,
      };
    default: {
      const frag = isGenericFragment(v, fieldId);
      const valid = v.length >= 3 && WORD_COUNT(v) <= 30 && !frag;
      return { valid, formatScore: valid ? 0.7 : 0.2 };
    }
  }
}

/**
 * Normalize raw capture to a business value; reject fragments.
 */
export function normalizeFieldValue(
  raw: string,
  def: ProductionFieldDefinition
): NormalizationResult {
  const fragmentReason = isGenericFragment(raw, def.id);
  if (fragmentReason) {
    return { normalized: null, rejected: true, rejectReason: fragmentReason, formatScore: 0, isFragment: true };
  }

  let normalized: string | null = null;

  switch (def.id) {
    case 'tenderNumber':
    case 'tenderReferenceNumber':
      normalized = normalizeTenderNumber(raw);
      break;
    case 'contractDuration':
      normalized = normalizeDuration(raw);
      break;
    case 'emdAmount':
    case 'tenderFee':
    case 'performanceSecurity':
    case 'bankGuarantee':
    case 'bidSecurityAmount':
    case 'estimatedTenderValue':
      normalized = normalizeMoney(raw);
      break;
    case 'turnoverRequirements':
      normalized = normalizeTurnover(raw);
      break;
    case 'experienceRequirements':
      normalized = normalizeExperience(raw);
      break;
    case 'gstRequirement':
      normalized = normalizeStatutory(raw, 'gst');
      break;
    case 'epfRequirement':
      normalized = normalizeStatutory(raw, 'epf');
      break;
    case 'esiRequirement':
      normalized = normalizeStatutory(raw, 'esi');
      break;
    case 'labourLicense':
      normalized = normalizeStatutory(raw, 'labour');
      break;
    case 'reverseAuction': {
      const t = raw.trim().toLowerCase();
      if (/not\s+applicable|^\s*no\s*$/i.test(t)) normalized = 'No';
      else if (/yes|applicable|reverse/i.test(t)) normalized = 'Yes';
      else normalized = null;
      break;
    }
    case 'submissionMode':
      normalized = normalizeSubmissionMode(raw);
      break;
    case 'workLocation':
      normalized = normalizeWorkLocation(raw);
      break;
    case 'bidSubmissionDate':
    case 'bidOpeningDate':
    case 'preBidMeetingDate':
      normalized = normalizeDate(raw);
      break;
    case 'tenderName':
    case 'organization':
    case 'department':
    case 'scopeOfWork':
      normalized = stripLabelPrefix(raw, def.labels);
      if (isGenericFragment(normalized, def.id)) normalized = null;
      else if (def.id === 'scopeOfWork' && WORD_COUNT(normalized) > 50) {
        normalized = normalized.slice(0, 400);
      } else if (WORD_COUNT(normalized) > 25 && def.valueType !== 'list') {
        normalized = null;
      }
      break;
    default:
      if (def.valueType === 'list') {
        const items = (raw.includes(' | ') ? raw.split(/\s*\|\s*/) : [raw])
          .map((i) => stripLabelPrefix(i, def.labels))
          .filter((i) => i.length >= 4 && !isGenericFragment(i, def.id));
        if (items.length) normalized = items.slice(0, def.listMaxItems || 15).join(' | ');
        break;
      }
      normalized = stripLabelPrefix(raw, def.labels);
      if (isGenericFragment(normalized, def.id)) normalized = null;
      else if (WORD_COUNT(normalized) > 20) normalized = null;
      break;
  }

  if (!normalized) {
    return {
      normalized: null,
      rejected: true,
      rejectReason: 'Could not normalize to a business value',
      formatScore: 0,
      isFragment: true,
    };
  }

  normalized = normalized.replace(/\s+/g, ' ').trim();

  const { valid, formatScore } = validateNormalizedFormat(def.id, normalized);
  if (!valid) {
    return {
      normalized: null,
      rejected: true,
      rejectReason: 'Fails field format validation',
      formatScore,
      isFragment: false,
    };
  }

  return { normalized, rejected: false, formatScore, isFragment: false };
}

export interface ConfidenceBreakdown {
  total: number;
  contextMatch: number;
  sectionMatch: number;
  headingMatch: number;
  formatMatch: number;
  tableMatch: number;
  aiVerification: number;
  crossValidation: number;
}

export interface ConfidenceInputs {
  contextScore: number;
  headingScore: number;
  formatScore: number;
  sectionMatchScore: number;
  crossScore: number;
  /** 0–1 when value came from structured table extraction */
  tableMatchScore?: number;
  /** 0–1 from AI single-field or tie-break verification */
  aiVerificationScore?: number;
}

/**
 * Multi-factor confidence from evidence — no fixed per-candidate seeds.
 */
export function computeFieldConfidence(inputs: ConfidenceInputs): ConfidenceBreakdown {
  const {
    contextScore,
    headingScore,
    formatScore,
    sectionMatchScore,
    crossScore,
    tableMatchScore = 0,
    aiVerificationScore = 0,
  } = inputs;

  const formatMatch = formatScore * 0.32;
  const contextMatch = Math.min(1, contextScore) * 0.22;
  const sectionMatch = sectionMatchScore * 0.12;
  const headingMatch = Math.min(1, headingScore / 0.15) * 0.08;
  const tableMatch = Math.min(1, tableMatchScore) * 0.12;
  const aiVerification = Math.min(1, aiVerificationScore) * 0.1;
  const crossValidation = crossScore >= 1 ? 0.06 : crossScore >= 0.7 ? 0.04 : 0.02;

  let total =
    formatMatch +
    contextMatch +
    sectionMatch +
    headingMatch +
    tableMatch +
    aiVerification +
    crossValidation;

  if (formatScore >= 0.88 && contextScore >= 0.4 && tableMatchScore >= 0.5) total += 0.03;
  if (aiVerificationScore >= 0.85 && formatScore >= 0.8) total += 0.02;
  total = Math.min(0.97, Math.max(0, total));

  return {
    total: Math.round(total * 100) / 100,
    contextMatch,
    sectionMatch,
    headingMatch,
    formatMatch,
    tableMatch,
    aiVerification,
    crossValidation,
  };
}

/** Would a tender consultant accept this on the dashboard? */
export function consultantQualityCheck(
  fieldId: string,
  value: string,
  sourceText: string
): boolean {
  const frag = isGenericFragment(value, fieldId);
  if (frag) return false;

  const { valid } = validateNormalizedFormat(fieldId, value);
  if (!valid) return false;

  if (value.length < 3) return false;

  if (/\b(?:refer|see)\s+(?:above|below|annexure)/i.test(value)) return false;

  if (sourceText && value.length > sourceText.length * 0.9 && WORD_COUNT(value) > 20) {
    if (!['scopeOfWork', 'experienceRequirements'].includes(fieldId)) return false;
  }

  return true;
}
