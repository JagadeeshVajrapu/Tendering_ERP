/**
 * Production-grade Field Dictionary Validation Engine.
 * Every stored/displayed value must pass dictionary rules (whitelist + reject patterns).
 */

export interface FieldDictionaryResult {
  valid: boolean;
  normalizedValue: string | null;
  rejectReason?: string;
  /** 0–100 match quality for ranking */
  dictionaryScore: number;
}

export interface FieldDictionaryEntry {
  id: string;
  /** Hard reject — value must not match any */
  rejectPatterns: RegExp[];
  /** Context reject — surrounding text must not match (unless allowed context also matches) */
  rejectContextPatterns?: RegExp[];
  allowContextPatterns?: RegExp[];
  maxWords: number;
  validate: (value: string, context: string) => FieldDictionaryResult;
}

const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const REJECT_TECHNICAL =
  /\btechnical\s+requirements?\b|\btechnical\s+specification|\bcctv\b|\bcamera\b|\bequipment\b|\binstallation\b|\bsupply\s+of\b/i;

const REJECT_FINANCIAL =
  /\bfinancial\s+conditions?\b|\bearnest\s+money\b|\bperformance\s+security\b|\bliquidated\s+damages\b/i;

const REJECT_ELIGIBILITY =
  /\beligibility\s+criteria\b|\bqualification\s+criteria\b|\bpre-?qualification\b|\bbidder\s+should\s+have\b/i;

const REJECT_PARAGRAPH =
  /\bthe bidder shall\b|\bhereinafter\b|\bnotwithstanding\b|\bshall comply\b/i;

const MONEY =
  /(?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d+)?\s*(?:\/-)?(?:\s*(?:crore|cr|lakh|lac|million|thousand))?/i;

const TENDER_ID = /\b[A-Z]{2,}[A-Z0-9]*(?:[/\-_.][A-Z0-9]+)+\b|\b\d{4,}[/-]\d{2,}[/-][A-Z0-9/\-_.]+\b/i;

const DURATION =
  /\b\d+\s*(?:days?|months?|weeks?|years?|yrs?)\b|\b(?:one|two|three|four|five|six|twelve)\s*(?:\(?\d*\)?\s*)?(?:years?|months?)\b/i;

function fail(reason: string, score = 0): FieldDictionaryResult {
  return { valid: false, normalizedValue: null, rejectReason: reason, dictionaryScore: score };
}

function ok(value: string, score: number): FieldDictionaryResult {
  return { valid: true, normalizedValue: value, dictionaryScore: score };
}

function checkRejects(
  value: string,
  context: string,
  entry: Pick<FieldDictionaryEntry, 'rejectPatterns' | 'rejectContextPatterns' | 'allowContextPatterns' | 'maxWords'>
): string | null {
  const v = value.trim();
  if (!v || v.length < 1) return 'Empty value';
  if (wc(v) > entry.maxWords) return `Exceeds ${entry.maxWords} words`;
  if (REJECT_PARAGRAPH.test(v)) return 'Paragraph / legal text';

  for (const p of entry.rejectPatterns) {
    if (p.test(v)) return 'Value matches reject pattern';
  }

  if (entry.rejectContextPatterns?.length) {
    const ctx = context.toLowerCase();
    const bad = entry.rejectContextPatterns.some((p) => p.test(ctx));
    const good = entry.allowContextPatterns?.some((p) => p.test(ctx));
    if (bad && !good) return 'Wrong document context';
  }

  return null;
}

/** Submission Mode — strict whitelist only. */
function validateSubmissionMode(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 6,
    rejectPatterns: [
      REJECT_TECHNICAL,
      REJECT_FINANCIAL,
      REJECT_ELIGIBILITY,
      /\brequirements?\b/i,
      /\bspecification\b/i,
      /\bconditions?\b/i,
      /\bshall\b/i,
      /\bscope\s+of\s+work\b/i,
    ],
    rejectContextPatterns: [
      REJECT_TECHNICAL,
      REJECT_ELIGIBILITY,
      /technical\s+bid/i,
      /scope\s+of/i,
    ],
    allowContextPatterns: [
      /mode\s+of\s+submission/i,
      /submission\s+mode/i,
      /online\s+submission/i,
      /e-?tender/i,
      /portal/i,
    ],
  });
  if (reject) return fail(reject);

  const lower = value.trim().toLowerCase();
  if (/^online$/i.test(lower) || /\bonline\s+submission\b/i.test(lower)) {
    return ok('Online', 98);
  }
  if (/^offline$/i.test(lower) || /\boffline\s+submission\b/i.test(lower)) {
    return ok('Offline', 96);
  }
  if (/\bgem\b|gem\s+portal|government\s+e\s*marketplace/i.test(lower)) {
    return ok('GeM', 95);
  }
  if (/e-?tender/i.test(lower)) {
    return ok('E-Tender', 92);
  }
  if (/electronic\s+submission/i.test(lower)) {
    return ok('Electronic Submission', 90);
  }
  if (/nic\s+portal|cpp\s+portal/i.test(lower) && wc(value) <= 5) {
    return ok(value.trim().slice(0, 40), 88);
  }

  return fail('Not an allowed submission mode (Online, Offline, GeM, E-Tender, Electronic Submission)');
}

function validateYesNo(value: string, context: string, fieldLabel: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 8,
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY, /\brequirements?\b/i],
  });
  if (reject) return fail(reject);

  const t = value.trim().toLowerCase();
  if (/^(?:yes|y|applicable|required)$/i.test(t) || /\byes\b/i.test(t)) return ok('Yes', 95);
  if (/^(?:no|n|not applicable|n\/a)$/i.test(t) || /\bno\b/i.test(t)) return ok('No', 95);
  if (new RegExp(fieldLabel, 'i').test(value) && /yes|applicable/i.test(t)) return ok('Yes', 85);

  return fail(`Must be Yes or No for ${fieldLabel}`);
}

function validateContractDuration(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 12,
    rejectPatterns: [],
    rejectContextPatterns: [
      /bid\s+valid(?:ity)?/i,
      /tender\s+valid(?:ity)?/i,
      /agreement\s+execution/i,
      /execution\s+of\s+(?:the\s+)?(?:contract|agreement)/i,
      /within\s+\d+\s*days?\s+(?:from|of)\s+(?:signing|award)/i,
      /defect\s+liability/i,
    ],
    allowContextPatterns: [
      /contract\s+(?:period|duration)/i,
      /period\s+of\s+(?:completion|contract)/i,
      /completion\s+period/i,
      /duration\s+of\s+(?:contract|work)/i,
    ],
  });
  if (reject) return fail(reject);

  const v = value.trim();
  if (!DURATION.test(v)) return fail('Must be a duration (e.g. 12 Months, 2 Years, 180 Days)');

  const m = v.match(/(\d+)\s*(days?|months?|years?|weeks?)/i);
  if (m) {
    const n = m[1];
    const u = m[2].toLowerCase();
    const unit = u.startsWith('day')
      ? 'Days'
      : u.startsWith('month')
        ? 'Months'
        : u.startsWith('year')
          ? 'Years'
          : 'Weeks';
    return ok(`${n} ${unit}`, 94);
  }

  if (wc(v) <= 8) return ok(v.slice(0, 80), 80);
  return fail('Invalid contract duration format');
}

function validateTenderNumber(value: string, _context: string): FieldDictionaryResult {
  const v = value.trim();
  if (/^(?:tice|tend|emen|nit|refe)$/i.test(v)) return fail('OCR fragment');
  if (wc(v) === 1 && !/\d/.test(v)) return fail('Single word — not tender number');
  if (wc(v) > 10) return fail('Too many words — paragraph fragment');
  if (REJECT_PARAGRAPH.test(v)) return fail('Paragraph fragment');

  if (TENDER_ID.test(v)) return ok(v.replace(/\s+/g, ''), 96);
  if (/[A-Za-z]/i.test(v) && /\d/.test(v) && /[/\-_.]/.test(v) && v.length >= 5) {
    return ok(v, 90);
  }
  return fail('Tender number must use letters, digits, / - _');
}

function validateMoneyField(value: string, context: string, label: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 15,
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY],
  });
  if (reject) return fail(reject);

  if (!MONEY.test(value) && !/^\d+\s*%$/.test(value.trim())) {
    return fail(`${label} must contain currency and amount`);
  }
  return ok(value.trim().slice(0, 80), 92);
}

function validateTurnover(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 20,
    rejectPatterns: [REJECT_TECHNICAL],
    rejectContextPatterns: [/submission\s+mode/i, /online\s+submission/i],
  });
  if (reject) return fail(reject);

  const v = value.trim();
  if (!/turnover|revenue/i.test(v)) return fail('Must mention turnover');
  if (!MONEY.test(v) && !/\d+\s*(?:crore|cr|lakh|lac)/i.test(v)) {
    return fail('Must contain turnover amount');
  }
  return ok(v.slice(0, 150), 90);
}

function validateExperience(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 25,
    rejectPatterns: [REJECT_TECHNICAL],
  });
  if (reject) return fail(reject);

  if (!/experience|similar\s+work|years?\s+of|completed\s+work/i.test(value)) {
    return fail('Must mention experience, similar work, or years');
  }
  return ok(value.trim().slice(0, 200), 88);
}

function validateGst(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 10,
    rejectPatterns: [
      REJECT_TECHNICAL,
      REJECT_ELIGIBILITY,
      /experience\s+requirement/i,
      /turnover/i,
      /\bsimilar\s+work\b/i,
    ],
  });
  if (reject) return fail(reject);

  if (!/gst|goods\s+and\s+services/i.test(value)) return fail('Must reference GST');
  if (wc(value) > 12) return fail('Eligibility paragraph — not GST field');
  return ok(
    /registration|required|valid/i.test(value) ? 'GST Registration Required' : value.trim().slice(0, 60),
    88
  );
}

function validateEpf(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 10,
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY, /gst\s+only/i],
  });
  if (reject) return fail(reject);
  if (!/epf|provident/i.test(value)) return fail('Must reference EPF');
  return ok('EPF Registration Required', 88);
}

function validateEsi(value: string, context: string): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords: 10,
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY],
  });
  if (reject) return fail(reject);
  if (!/esi|employees?\s+state/i.test(value)) return fail('Must reference ESI');
  return ok('ESI Registration Required', 88);
}

function validateWorkLocation(value: string, context: string): FieldDictionaryResult {
  const v = value.trim();
  const reject = checkRejects(value, context, {
    maxWords: 12,
    rejectPatterns: [REJECT_TECHNICAL, /\bonline\s+submission\b/i, /e-?tender/i],
  });
  if (reject) return fail(reject);
  if (v.length < 3) return fail('Too short');
  return ok(v.slice(0, 120), 85);
}

function validateDefault(value: string, context: string, maxWords: number): FieldDictionaryResult {
  const reject = checkRejects(value, context, {
    maxWords,
    rejectPatterns: [REJECT_TECHNICAL, REJECT_PARAGRAPH],
  });
  if (reject) return fail(reject);
  return ok(value.trim().slice(0, 300), 70);
}

const DICTIONARY: Record<string, FieldDictionaryEntry> = {
  submissionMode: {
    id: 'submissionMode',
    rejectPatterns: [REJECT_TECHNICAL, REJECT_FINANCIAL, REJECT_ELIGIBILITY],
    maxWords: 6,
    validate: validateSubmissionMode,
  },
  bidSystem: {
    id: 'bidSystem',
    rejectPatterns: [REJECT_TECHNICAL, /\brequirements?\b/i],
    maxWords: 10,
    validate: (v, c) => {
      const r = validateSubmissionMode(v, c);
      if (r.valid) return r;
      if (/two\s+(?:bid|envelope)|single\s+stage/i.test(v) && wc(v) <= 8) {
        return ok(v.slice(0, 60), 85);
      }
      return fail('Not a valid bid system value');
    },
  },
  reverseAuction: {
    id: 'reverseAuction',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 6,
    validate: (v, c) => validateYesNo(v, c, 'reverse auction'),
  },
  mafRequired: {
    id: 'mafRequired',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 6,
    validate: (v, c) => validateYesNo(v, c, 'maf'),
  },
  contractDuration: {
    id: 'contractDuration',
    rejectPatterns: [],
    maxWords: 12,
    validate: validateContractDuration,
  },
  tenderNumber: {
    id: 'tenderNumber',
    rejectPatterns: [],
    maxWords: 10,
    validate: validateTenderNumber,
  },
  tenderReferenceNumber: {
    id: 'tenderReferenceNumber',
    rejectPatterns: [],
    maxWords: 10,
    validate: validateTenderNumber,
  },
  estimatedTenderValue: {
    id: 'estimatedTenderValue',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'Tender value'),
  },
  estimatedCost: {
    id: 'estimatedCost',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'Tender value'),
  },
  emdAmount: {
    id: 'emdAmount',
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'EMD'),
  },
  tenderFee: {
    id: 'tenderFee',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'Tender fee'),
  },
  bidSecurityAmount: {
    id: 'bidSecurityAmount',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'Bid security'),
  },
  performanceSecurity: {
    id: 'performanceSecurity',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'Performance security'),
  },
  bankGuarantee: {
    id: 'bankGuarantee',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 15,
    validate: (v, c) => validateMoneyField(v, c, 'Bank guarantee'),
  },
  turnoverRequirements: {
    id: 'turnoverRequirements',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 20,
    validate: validateTurnover,
  },
  experienceRequirements: {
    id: 'experienceRequirements',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 25,
    validate: validateExperience,
  },
  gstRequirement: {
    id: 'gstRequirement',
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY],
    maxWords: 10,
    validate: validateGst,
  },
  epfRequirement: {
    id: 'epfRequirement',
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY],
    maxWords: 10,
    validate: validateEpf,
  },
  esiRequirement: {
    id: 'esiRequirement',
    rejectPatterns: [REJECT_TECHNICAL, REJECT_ELIGIBILITY],
    maxWords: 10,
    validate: validateEsi,
  },
  workLocation: {
    id: 'workLocation',
    rejectPatterns: [REJECT_TECHNICAL],
    maxWords: 12,
    validate: validateWorkLocation,
  },
};

/** All field IDs with dictionary entries (priority list for AI). */
export const DICTIONARY_FIELD_IDS = new Set(Object.keys(DICTIONARY));

/**
 * Validate and normalize via field dictionary (Step 4).
 */
export function validateFieldDictionary(
  fieldId: string,
  value: string,
  context = ''
): FieldDictionaryResult {
  const entry = DICTIONARY[fieldId];
  if (!entry) {
    return validateDefault(value, context, 25);
  }
  return entry.validate(value, context);
}

export function isRejectedByDictionary(fieldId: string, value: string, context = ''): boolean {
  return !validateFieldDictionary(fieldId, value, context).valid;
}

/** Executive display gate — must pass dictionary. */
export function isDisplayableByDictionary(fieldId: string, value: string, context = ''): boolean {
  const r = validateFieldDictionary(fieldId, value, context);
  return r.valid && !!r.normalizedValue;
}

/** Re-export for pipeline compatibility */
export function validateFieldBusinessRules(
  fieldId: string,
  value: string,
  context: string
): { valid: boolean; normalizedValue: string | null; rejectReason?: string } {
  const r = validateFieldDictionary(fieldId, value, context);
  return {
    valid: r.valid,
    normalizedValue: r.normalizedValue,
    rejectReason: r.rejectReason,
  };
}

export const MANDATORY_AI_VERIFY_FIELD_IDS = DICTIONARY_FIELD_IDS;
