import { PageText } from '../../types/intelligence';
import {
  AmountExtractionDebug,
  FieldLocatorMethod,
  FieldLocatorResult,
  TenderValueCrossValidation,
  TenderValueExtractionCandidateDebug,
} from '../../types/fieldLocator';
import {
  formatIndianAmount,
  numericValue,
  validateIndianAmount,
} from './fieldLocatorAmount';
import { findEvidenceLine, buildConfidence } from './fieldLocatorUtils';
import {
  extractExplicitEmdStatements,
  findEmdPercentageInDocument,
  pageWeight,
} from './fieldLocatorEmdEngine';
import { FieldLocatorRunOptions, isFieldLocatorDebugMode } from './fieldLocatorOptions';

const IMMEDIATE_FOLLOW_CHARS = 120;
const CONTEXT_RADIUS = 200;

const TENDER_VALUE_LABELS: Array<{ pattern: string; priority: number; method: FieldLocatorMethod }> = [
  { pattern: 'Estimated Cost of Work', priority: 1, method: 'keyword' },
  { pattern: 'Estimated Cost', priority: 2, method: 'keyword' },
  { pattern: 'Tender Value', priority: 3, method: 'keyword' },
  { pattern: 'Tender Amount', priority: 4, method: 'keyword' },
  { pattern: 'Estimated Tender Value', priority: 5, method: 'keyword' },
  { pattern: 'Contract Value', priority: 6, method: 'keyword' },
  { pattern: 'Approximate Cost of Work', priority: 7, method: 'keyword' },
  { pattern: 'Approximate Cost', priority: 8, method: 'keyword' },
  { pattern: 'Cost of Work', priority: 9, method: 'keyword' },
  { pattern: 'Project Cost', priority: 10, method: 'keyword' },
];

const COST_CONTEXT_RX =
  /\b(?:Estimated\s+Cost|Tender\s+Value|Tender\s+Amount|Contract\s+Value|Approximate\s+Cost|Cost\s+of\s+Work|Project\s+Cost)\b/i;

const REJECT_CONTEXT_RX =
  /(?:experience\s+section|experience\s+requirement|years?\s+of\s+experience|turnover\s+requirement|annual\s+turnover|minimum\s+turnover|financial\s+capacity|previous\s+work\s+order|work\s+order\s+value|annexure|appendix|bank\s+statement|balance\s+sheet|financial\s+statement|net\s+worth|bid\s+capacity)/i;

const AMOUNT_CAPTURE = '(?:₹|Rs\\.?|INR)\\s*:?\\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5})';

export interface ExplicitTenderValueHit {
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

function contextWindow(text: string, center: number): string {
  const start = Math.max(0, center - CONTEXT_RADIUS);
  const end = Math.min(text.length, center + CONTEXT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function extractAmountAfterLabel(
  text: string,
  labelEndIndex: number
): { amount: string; numericPart: string } | null {
  const slice = text.slice(labelEndIndex, labelEndIndex + IMMEDIATE_FOLLOW_CHARS);
  const rx = new RegExp(AMOUNT_CAPTURE, 'i');
  const m = rx.exec(slice);
  if (!m?.[1]) return null;

  const cleaned = m[1].replace(/\s+/g, '').replace(/[^\d,]/g, '');
  const value = formatIndianAmount(cleaned);
  if (!validateIndianAmount(value, cleaned).valid) return null;

  return { amount: value, numericPart: cleaned };
}

/** Priority 1: explicit cost label → amount immediately following */
export function extractExplicitTenderValueStatements(pages: PageText[]): ExplicitTenderValueHit[] {
  const hits: ExplicitTenderValueHit[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;
    const lower = text.toLowerCase();

    for (const { pattern, priority, method } of TENDER_VALUE_LABELS) {
      const lowerPat = pattern.toLowerCase();
      let from = 0;

      while (from < lower.length) {
        const idx = lower.indexOf(lowerPat, from);
        if (idx < 0) break;
        from = idx + 1;

        const before = idx === 0 || !/\w/.test(text[idx - 1]);
        const afterIdx = idx + pattern.length;
        const after = afterIdx >= text.length || !/\w/.test(text[afterIdx]);
        if (!before) continue;

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

function withinPercentTolerance(actual: number, expected: number, tolerancePct = 5): boolean {
  if (expected <= 0) return false;
  return Math.abs(actual - expected) / expected <= tolerancePct / 100;
}

export function resolveEmdAmountNumeric(pages: PageText[]): number | null {
  const emdHits = extractExplicitEmdStatements(pages);
  const valid = emdHits.filter((h) => {
    const n = numericValue(h.numericPart);
    return n > 0 && n < 500_000_000;
  });
  if (!valid.length) return null;
  return numericValue(
    valid.sort((a, b) => a.labelPriority - b.labelPriority || a.page - b.page)[0].numericPart
  );
}

export function validateTenderValueCandidate(
  hit: ExplicitTenderValueHit,
  options?: FieldLocatorRunOptions
): {
  accepted: boolean;
  reasonAccepted?: string;
  reasonRejected?: string;
} {
  if (isFieldLocatorDebugMode(options)) {
    return {
      accepted: true,
      reasonAccepted: 'Debug mode: rejection rules disabled (turnover/annexure/experience/financial)',
    };
  }

  const ctx = hit.context;

  if (REJECT_CONTEXT_RX.test(ctx)) {
    return {
      accepted: false,
      reasonRejected:
        'Context matches experience / turnover / financial capacity / work order / annexure / bank statement',
    };
  }

  if (!COST_CONTEXT_RX.test(ctx)) {
    return {
      accepted: false,
      reasonRejected: `No tender cost label within ${CONTEXT_RADIUS} characters of amount`,
    };
  }

  return {
    accepted: true,
    reasonAccepted: `Explicit clause: "${hit.label}" → ${hit.amount} (page ${hit.page}, weight ${hit.pageWeight})`,
  };
}

/** Prefer label priority, page weight, earliest occurrence — never largest amount */
function selectBestExplicit(
  valid: ExplicitTenderValueHit[],
  preferredAmount: string | null
): ExplicitTenderValueHit | null {
  if (!valid.length) return null;

  if (preferredAmount) {
    const match = valid.find((h) => h.amount === preferredAmount);
    if (match) return match;
  }

  return [...valid].sort((a, b) => {
    if (a.labelPriority !== b.labelPriority) return a.labelPriority - b.labelPriority;
    if (b.pageWeight !== a.pageWeight) return b.pageWeight - a.pageWeight;
    if (a.page !== b.page) return a.page - b.page;
    return a.charIndex - b.charIndex;
  })[0];
}

export function extractTenderValueWithRules(
  pages: PageText[],
  options?: FieldLocatorRunOptions
): {
  field: FieldLocatorResult | null;
  debug: AmountExtractionDebug;
  failureReason?: string;
} {
  const fieldName = 'Tender Value' as const;
  const debugMode = isFieldLocatorDebugMode(options);
  const explicitHits = extractExplicitTenderValueStatements(pages);

  const validations = new Map<
    string,
    { accepted: boolean; reasonAccepted?: string; reasonRejected?: string }
  >();
  const validHits: ExplicitTenderValueHit[] = [];

  for (const hit of explicitHits) {
    const key = `${hit.page}:${hit.amount}:${hit.charIndex}`;
    const result = validateTenderValueCandidate(hit, options);
    validations.set(key, result);
    if (result.accepted) validHits.push(hit);
  }

  const hitsForSelection = debugMode && explicitHits.length ? explicitHits : validHits;

  const emdNumeric = resolveEmdAmountNumeric(pages);
  const emdPercent = findEmdPercentageInDocument(pages);

  let crossValidation: TenderValueCrossValidation | null = null;
  let crossValidatedAmount: string | null = null;

  if (emdNumeric != null && emdPercent != null && emdPercent > 0) {
    const expectedNumeric = Math.round((emdNumeric * 100) / emdPercent);
    const expectedFormatted = formatIndianAmount(String(expectedNumeric));
    crossValidatedAmount = expectedFormatted;

    const matchedHit = validHits.find((h) =>
      withinPercentTolerance(numericValue(h.numericPart), expectedNumeric)
    );

    crossValidation = {
      emdAmount: formatIndianAmount(String(emdNumeric)),
      emdPercent,
      calculatedTenderValue: expectedFormatted,
      formula: `EMD × ${100 / emdPercent} (EMD @ ${emdPercent}%)`,
      matched: matchedHit != null,
      matchedAmount: matchedHit?.amount ?? null,
      tolerancePercent: 5,
    };
  }

  const selected = selectBestExplicit(
    hitsForSelection,
    debugMode ? null : crossValidation?.matched ? crossValidation.matchedAmount : null
  );

  let confidence = selected ? buildConfidence(92, selected.page) : 0;
  let extractionRule: AmountExtractionDebug['tenderValueExtractionRule'] = 'explicit_statement';

  if (
    selected &&
    crossValidation?.matched &&
    crossValidation.matchedAmount === selected.amount
  ) {
    confidence = 100;
    extractionRule = 'emd_cross_validated';
  }

  const candidateDebug: TenderValueExtractionCandidateDebug[] = explicitHits.map((h) => {
    const key = `${h.page}:${h.amount}:${h.charIndex}`;
    const v = validations.get(key)!;
    return {
      label: h.label,
      amount: h.amount,
      page: h.page,
      context: h.context.slice(0, 280),
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
    tenderValueCandidates: candidateDebug,
    tenderValueCrossValidation: crossValidation,
    tenderValueExtractionRule: selected ? extractionRule : null,
    debugMode,
  };

  if (!selected) {
    return {
      field: null,
      debug,
      failureReason:
        explicitHits.length > 0
          ? 'Cost labels found but no amount passed tender-clause validation'
          : 'No explicit tender cost clause (e.g. Estimated Cost : Rs. …) found',
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
