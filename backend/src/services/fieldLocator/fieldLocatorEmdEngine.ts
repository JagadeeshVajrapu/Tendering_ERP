import { PageText } from '../../types/intelligence';
import {
  AmountExtractionDebug,
  EmdExtractionCandidateDebug,
  EmdPercentageValidation,
  FieldLocatorMethod,
  FieldLocatorResult,
} from '../../types/fieldLocator';
import {
  formatIndianAmount,
  numericValue,
  validateIndianAmount,
} from './fieldLocatorAmount';
import { findEvidenceLine, buildConfidence } from './fieldLocatorUtils';
import { selectTenderValueFromPairedHits } from './fieldLocatorPairedAmount';
import { FieldLocatorRunOptions, isFieldLocatorDebugMode } from './fieldLocatorOptions';

/** Amount must follow label within this many characters */
const IMMEDIATE_FOLLOW_CHARS = 120;
const EMD_CONTEXT_RADIUS = 200;

const EMD_LABELS_ORDERED: Array<{ pattern: string; priority: number; method: FieldLocatorMethod }> = [
  { pattern: 'EMD Amount', priority: 1, method: 'keyword' },
  { pattern: 'Amount of EMD', priority: 2, method: 'keyword' },
  { pattern: 'Earnest Money Deposit', priority: 3, method: 'keyword' },
  { pattern: 'Earnest Money', priority: 4, method: 'keyword' },
  { pattern: 'Bid Security', priority: 5, method: 'alias' },
  { pattern: 'Security Deposit', priority: 6, method: 'alias' },
  { pattern: 'EMD', priority: 7, method: 'keyword' },
];

const EMD_CONTEXT_RX =
  /\b(?:EMD|Earnest\s+Money(?:\s+Deposit)?|Bid\s+Security|Security\s+Deposit)\b/i;

const REJECT_CONTEXT_RX =
  /(?:financial\s+statement|balance\s+sheet|turnover\s+requirement|annual\s+turnover|work\s+order|experience\s+clause|years?\s+of\s+experience|annexure|appendix|schedule\s+[ivx\d]+)/i;

const AMOUNT_CAPTURE = '(?:₹|Rs\\.?|INR)\\s*:?\\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5})';
const EMD_PERCENT_RX = /\bEMD\s*[@]?\s*(\d+(?:\.\d+)?)\s*%/gi;

export interface ExplicitEmdHit {
  amount: string;
  numericPart: string;
  page: number;
  charIndex: number;
  label: string;
  labelPriority: number;
  method: FieldLocatorMethod;
  context: string;
  sourceText: string;
  pageWeight: number;
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pageWeight(pageNumber: number): number {
  if (pageNumber <= 10) return 100;
  if (pageNumber <= 20) return 50;
  return 10;
}

function contextWindow(text: string, center: number, radius = EMD_CONTEXT_RADIUS): string {
  const start = Math.max(0, center - radius);
  const end = Math.min(text.length, center + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function extractAmountAfterLabel(
  text: string,
  labelEndIndex: number
): { amount: string; numericPart: string; distance: number } | null {
  const slice = text.slice(labelEndIndex, labelEndIndex + IMMEDIATE_FOLLOW_CHARS);
  const rx = new RegExp(AMOUNT_CAPTURE, 'i');
  const m = rx.exec(slice);
  if (!m?.[1]) return null;

  const cleaned = m[1].replace(/\s+/g, '').replace(/[^\d,]/g, '');
  const value = formatIndianAmount(cleaned);
  if (!validateIndianAmount(value, cleaned).valid) return null;

  return {
    amount: value,
    numericPart: cleaned,
    distance: m.index ?? 0,
  };
}

/** Priority 1: explicit label → amount on same line / immediate follow */
export function extractExplicitEmdStatements(pages: PageText[]): ExplicitEmdHit[] {
  const hits: ExplicitEmdHit[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;
    const lower = text.toLowerCase();

    for (const { pattern, priority, method } of EMD_LABELS_ORDERED) {
      const lowerPat = pattern.toLowerCase();
      let from = 0;

      while (from < lower.length) {
        const idx = lower.indexOf(lowerPat, from);
        if (idx < 0) break;
        from = idx + 1;

        const before = idx === 0 || !/\w/.test(text[idx - 1]);
        const afterIdx = idx + pattern.length;
        const after = afterIdx >= text.length || !/\w/.test(text[afterIdx]);
        if (!before && pattern.length < 12) continue;
        if (!after && pattern === 'EMD') continue;

        const parsed = extractAmountAfterLabel(text, afterIdx);
        if (!parsed) continue;

        const key = `${page.pageNumber}:${parsed.amount}:${idx}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const center = idx + Math.floor(pattern.length / 2);
        hits.push({
          amount: parsed.amount,
          numericPart: parsed.numericPart,
          page: page.pageNumber,
          charIndex: idx,
          label: pattern,
          labelPriority: priority,
          method,
          context: contextWindow(text, center),
          sourceText: findEvidenceLine(text, idx),
          pageWeight: pageWeight(page.pageNumber),
        });
      }
    }
  }

  return hits;
}

export function resolveTenderValueNumeric(pages: PageText[]): number | null {
  const paired = selectTenderValueFromPairedHits(pages, pages);
  if (paired.best) return numericValue(paired.best.numericPart);

  for (const page of pages) {
    const text = page.text || '';
    const rx =
      /(?:Estimated\s+Cost(?:\s+of\s+Work)?|Tender\s+Value|Contract\s+Value)\s*[:–\-]?\s*(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5})/gi;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const n = numericValue(m[1]);
      if (n > 0) return n;
    }
  }
  return null;
}

export function findEmdPercentageInDocument(pages: PageText[]): number | null {
  for (const page of pages) {
    const text = page.text || '';
    EMD_PERCENT_RX.lastIndex = 0;
    const m = EMD_PERCENT_RX.exec(text);
    if (m?.[1]) return parseFloat(m[1]);
  }
  return null;
}

function withinPercentTolerance(actual: number, expected: number, tolerancePct = 5): boolean {
  if (expected <= 0) return false;
  const diff = Math.abs(actual - expected) / expected;
  return diff <= tolerancePct / 100;
}

export interface EmdValidationInput {
  hit: ExplicitEmdHit;
  tenderValueNumeric: number | null;
}

export function validateEmdCandidate(
  input: EmdValidationInput,
  options?: FieldLocatorRunOptions
): { accepted: boolean; reasonAccepted?: string; reasonRejected?: string } {
  if (isFieldLocatorDebugMode(options)) {
    return {
      accepted: true,
      reasonAccepted: 'Debug mode: rejection rules disabled (turnover/annexure/experience/20% TV)',
    };
  }

  const { hit, tenderValueNumeric } = input;
  const ctx = hit.context;

  if (REJECT_CONTEXT_RX.test(ctx)) {
    return {
      accepted: false,
      reasonRejected: 'Context matches annexure / financial statement / turnover / experience',
    };
  }

  if (!EMD_CONTEXT_RX.test(ctx)) {
    return {
      accepted: false,
      reasonRejected: `No EMD-related keyword within ${EMD_CONTEXT_RADIUS} characters`,
    };
  }

  const amountNum = numericValue(hit.numericPart);

  if (tenderValueNumeric != null && tenderValueNumeric > 0) {
    if (amountNum > tenderValueNumeric * 0.2) {
      return {
        accepted: false,
        reasonRejected: `Amount exceeds 20% of tender value (${formatIndianAmount(String(tenderValueNumeric))})`,
      };
    }
  }

  if (hit.labelPriority >= 7 && !/\bEMD\s+Amount\b/i.test(ctx) && !/Earnest\s+Money/i.test(ctx)) {
    const hasStrongLabel = /EMD\s+Amount|Amount\s+of\s+EMD|Earnest\s+Money\s+Deposit/i.test(ctx);
    if (!hasStrongLabel && hit.page > 20) {
      return {
        accepted: false,
        reasonRejected: 'Bare "EMD" on late page without strong EMD clause context',
      };
    }
  }

  return {
    accepted: true,
    reasonAccepted: `Explicit statement: "${hit.label}" → ${hit.amount} (page ${hit.page}, weight ${hit.pageWeight})`,
  };
}

/** Pick best explicit hit: label priority + page weight — never by amount size */
function selectBestExplicit(valid: ExplicitEmdHit[]): ExplicitEmdHit | null {
  if (!valid.length) return null;

  return [...valid].sort((a, b) => {
    if (a.labelPriority !== b.labelPriority) return a.labelPriority - b.labelPriority;
    if (b.pageWeight !== a.pageWeight) return b.pageWeight - a.pageWeight;
    if (a.page !== b.page) return a.page - b.page;
    return a.charIndex - b.charIndex;
  })[0];
}

function buildCandidateDebug(
  hits: ExplicitEmdHit[],
  validations: Map<string, { accepted: boolean; reasonAccepted?: string; reasonRejected?: string }>,
  selected: ExplicitEmdHit | null,
  percentageValidation: EmdPercentageValidation | null
): EmdExtractionCandidateDebug[] {
  return hits.map((h) => {
    const v = validations.get(`${h.page}:${h.amount}:${h.charIndex}`)!;
    return {
      amount: h.amount,
      page: h.page,
      context: h.context.slice(0, 280),
      keyword: h.label,
      pageWeight: h.pageWeight,
      accepted: v.accepted,
      reasonAccepted: v.reasonAccepted,
      reasonRejected: v.reasonRejected,
      selected:
        selected != null &&
        selected.page === h.page &&
        selected.amount === h.amount &&
        selected.charIndex === h.charIndex,
    };
  });
}

export function extractEmdWithRules(
  pages: PageText[],
  options?: FieldLocatorRunOptions
): {
  field: FieldLocatorResult | null;
  debug: AmountExtractionDebug;
  failureReason?: string;
} {
  const fieldName = 'EMD' as const;
  const debugMode = isFieldLocatorDebugMode(options);
  const explicitHits = extractExplicitEmdStatements(pages);
  const tenderValueNumeric = debugMode ? null : resolveTenderValueNumeric(pages);
  const emdPercent = findEmdPercentageInDocument(pages);

  const validations = new Map<
    string,
    { accepted: boolean; reasonAccepted?: string; reasonRejected?: string }
  >();

  const validHits: ExplicitEmdHit[] = [];
  for (const hit of explicitHits) {
    const key = `${hit.page}:${hit.amount}:${hit.charIndex}`;
    const result = validateEmdCandidate({ hit, tenderValueNumeric }, options);
    validations.set(key, result);
    if (result.accepted) validHits.push(hit);
  }

  const hitsForSelection = debugMode && explicitHits.length ? explicitHits : validHits;

  let percentageValidation: EmdPercentageValidation | null = null;
  if (emdPercent != null && tenderValueNumeric != null) {
    const calculated = Math.round((tenderValueNumeric * emdPercent) / 100);
    const calculatedFormatted = formatIndianAmount(String(calculated));
    const calculatedNum = calculated;

    let matchedAmount: string | null = null;
    for (const hit of validHits.length ? validHits : explicitHits) {
      if (withinPercentTolerance(numericValue(hit.numericPart), calculatedNum)) {
        matchedAmount = hit.amount;
        break;
      }
    }

    percentageValidation = {
      emdPercent,
      tenderValue: formatIndianAmount(String(tenderValueNumeric)),
      calculatedEmd: calculatedFormatted,
      matched: matchedAmount != null,
      matchedAmount,
      tolerancePercent: 5,
    };
  }

  const bestExplicit = selectBestExplicit(hitsForSelection);

  let selected: ExplicitEmdHit | null = bestExplicit;
  let confidence = bestExplicit ? buildConfidence(92, bestExplicit.page) : 0;
  let extractionRule: AmountExtractionDebug['emdExtractionRule'] = 'explicit_statement';

  if (
    percentageValidation?.matched &&
    percentageValidation.matchedAmount &&
    bestExplicit &&
    bestExplicit.amount === percentageValidation.matchedAmount
  ) {
    confidence = 100;
    extractionRule = 'percentage_validated';
  } else if (
    percentageValidation?.matched &&
    percentageValidation.matchedAmount &&
    !bestExplicit
  ) {
    const matchHit = (validHits.length ? validHits : explicitHits).find(
      (h) => h.amount === percentageValidation!.matchedAmount
    );
    if (matchHit) {
      selected = matchHit;
      confidence = 100;
      extractionRule = 'percentage_rule';
    }
  } else if (
    percentageValidation?.matched &&
    percentageValidation.matchedAmount &&
    bestExplicit &&
    bestExplicit.amount !== percentageValidation.matchedAmount
  ) {
    const pctHit = validHits.find((h) => h.amount === percentageValidation!.matchedAmount);
    if (pctHit && pctHit.labelPriority <= 4) {
      selected = pctHit;
      confidence = 100;
      extractionRule = 'percentage_validated';
    }
  }

  const candidateDebug = buildCandidateDebug(
    explicitHits,
    validations,
    selected,
    percentageValidation
  );

  const debug: AmountExtractionDebug = {
    keywordFound: selected?.label ?? null,
    allAmountsFound: [...new Set(explicitHits.map((h) => h.amount))],
    selectedAmount: selected?.amount ?? null,
    distanceFromKeyword: selected ? 0 : null,
    keywordMatches: explicitHits.map((h) => ({
      page: h.page,
      keyword: h.label,
      context: h.context.slice(0, 160),
      charIndex: h.charIndex,
    })),
    emdCandidates: candidateDebug,
    percentageValidation,
    emdExtractionRule: selected ? extractionRule : null,
    debugMode,
  };

  if (!selected) {
    return {
      field: null,
      debug,
      failureReason:
        explicitHits.length > 0
          ? 'EMD keywords found but no amount passed context / tender-value validation'
          : 'No explicit EMD statement (e.g. EMD Amount : Rs. …) found',
    };
  }

  return {
    field: {
      fieldName,
      value: selected.amount,
      sourcePage: selected.page,
      sourceText: selected.sourceText,
      extractionMethod: selected.method,
      confidence,
      amountDebug: debug,
    },
    debug,
  };
}
