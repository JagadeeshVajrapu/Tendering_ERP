import {
  AmountExtractionDebug,
  FieldLocatorMethod,
  KeywordMatchRecord,
  ScoredAmountCandidateRecord,
} from '../../types/fieldLocator';
import { findEvidenceLine, scoreMethod, buildConfidence } from './fieldLocatorUtils';

/** ±chars around each keyword occurrence */
export const AMOUNT_SEARCH_WINDOW = 2000;

export const INDIAN_AMOUNT_REGEX =
  /(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5})/gi;

const AMOUNT_WITH_SPACED_GROUPS =
  /(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{1,3}(?:[\s,]+[0-9]{2,3}){1,5})/gi;

export const AMOUNT_WITH_CURRENCY_PLAIN = /(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{4,12})/gi;

export type AmountSelectMode = 'highest_score' | 'largest_amount';

const CURRENCY_ONLY = /^(?:rs\.?,?|rs|inr|₹)\s*$/i;
const ONE_LAKH = 100_000;

export function digitCount(numeric: string): string {
  return numeric.replace(/,/g, '').replace(/\D/g, '');
}

export function digitCountNum(numeric: string): number {
  return digitCount(numeric).length;
}

export function numericValue(numericPart: string): number {
  const d = digitCount(numericPart);
  return d ? parseInt(d, 10) : 0;
}

function cleanNumericPart(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/\.{2,}/g, ',')
    .replace(/[^\d,]/g, '')
    .replace(/,+/g, ',')
    .replace(/^,|,$/g, '');
}

export function validateIndianAmount(full: string, numericPart: string): { valid: boolean; reason?: string } {
  const v = full.trim();
  if (!v || CURRENCY_ONLY.test(v)) {
    return { valid: false, reason: 'Currency symbol without numeric value' };
  }
  const cleaned = cleanNumericPart(numericPart);
  if (!cleaned || !/\d/.test(cleaned)) {
    return { valid: false, reason: 'No numeric value' };
  }
  if (digitCountNum(cleaned) < 4) {
    return { valid: false, reason: `Digit count ${digitCountNum(cleaned)} < 4` };
  }
  if (v.length > 60) return { valid: false, reason: 'Amount too long' };
  return { valid: true };
}

export function formatIndianAmount(numericPart: string): string {
  const cleaned = cleanNumericPart(numericPart);
  return `Rs. ${cleaned}`;
}

export function removePartialAmounts<T extends { value: string; numericPart: string }>(
  amounts: T[]
): T[] {
  return amounts.filter((a) => {
    const digitsA = digitCount(a.numericPart);
    if (!digitsA) return false;
    return !amounts.some((b) => {
      if (a === b) return false;
      const digitsB = digitCount(b.numericPart);
      if (digitsB.length <= digitsA.length) return false;
      return digitsB.endsWith(digitsA);
    });
  });
}

function captureFromMatch(
  numericRaw: string,
  absoluteIndex: number,
  found: Map<string, { value: string; absoluteIndex: number; numericPart: string }>
) {
  const cleaned = cleanNumericPart(numericRaw);
  if (!cleaned) return;
  const value = formatIndianAmount(cleaned);
  if (!validateIndianAmount(value, cleaned).valid) return;

  const existing = found.get(value);
  if (!existing || absoluteIndex < existing.absoluteIndex) {
    found.set(value, { value, absoluteIndex, numericPart: cleaned });
  }
}

export function findAllAmountsInText(
  text: string,
  sliceStart: number
): Array<{ value: string; absoluteIndex: number; numericPart: string }> {
  const found = new Map<string, { value: string; absoluteIndex: number; numericPart: string }>();

  const run = (regex: RegExp) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text))) {
      const numeric = m[1] || '';
      if (!numeric) continue;
      captureFromMatch(numeric, sliceStart + (m.index ?? 0), found);
    }
  };

  run(INDIAN_AMOUNT_REGEX);
  run(AMOUNT_WITH_SPACED_GROUPS);
  run(AMOUNT_WITH_CURRENCY_PLAIN);

  return Array.from(found.values()).sort((a, b) => a.absoluteIndex - b.absoluteIndex);
}

export function scoreAmountCandidate(params: {
  pageNumber: number;
  distanceFromKeyword: number;
  numericPart: string;
}): { score: number; breakdown: string[] } {
  const breakdown: string[] = [];
  let score = 0;

  score += 50;
  breakdown.push('+50 keyword and amount on same page');

  if (params.distanceFromKeyword <= 200) {
    score += 30;
    breakdown.push('+30 amount within 200 chars of keyword');
  }

  if (params.pageNumber < 10) {
    score += 20;
    breakdown.push('+20 page < 10');
  }

  if (numericValue(params.numericPart) > ONE_LAKH) {
    score += 20;
    breakdown.push('+20 amount > 1 lakh');
  }

  return { score, breakdown };
}

export interface KeywordAmountSearch {
  label: string;
  method: FieldLocatorMethod;
  priority?: number;
}

export type AmountFieldCandidate = {
  value: string;
  sourcePage: number;
  sourceText: string;
  method: FieldLocatorMethod;
  keywordMatched: string;
  confidence: number;
  amountDebug: AmountExtractionDebug;
  selectionScore: number;
};

function snippetContext(text: string, index: number, labelLength: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + labelLength + 80);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function isWordBoundary(text: string, idx: number, labelLen: number): boolean {
  const before = idx === 0 || !/\w/.test(text[idx - 1]);
  const after = idx + labelLen >= text.length || !/\w/.test(text[idx + labelLen]);
  return before && after;
}

/** Find every keyword hit on every page (do not stop at first). */
export function findAllKeywordMatches(
  pages: Array<{ pageNumber: number; text?: string }>,
  keywords: KeywordAmountSearch[]
): KeywordMatchRecord[] {
  const sorted = [...keywords].sort(
    (a, b) => b.label.length - a.label.length || (a.priority ?? 99) - (b.priority ?? 99)
  );
  const matches: KeywordMatchRecord[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;
    const lower = text.toLowerCase();

    for (const { label } of sorted) {
      const lowerLabel = label.toLowerCase();
      let from = 0;
      while (from < lower.length) {
        const idx = lower.indexOf(lowerLabel, from);
        if (idx < 0) break;
        from = idx + 1;

        if (!isWordBoundary(text, idx, label.length) && label.length < 12) continue;

        const key = `${page.pageNumber}:${idx}:${label}`;
        if (seen.has(key)) continue;
        seen.add(key);

        matches.push({
          page: page.pageNumber,
          keyword: label,
          context: snippetContext(text, idx, label.length),
          charIndex: idx,
        });
      }
    }
  }

  return matches;
}

/**
 * For each keyword occurrence: scan ±2000 chars, extract amounts, score candidates.
 * Rejects occurrences with no amount.
 */
export function buildScoredAmountCandidates(
  pages: Array<{ pageNumber: number; text?: string }>,
  keywords: KeywordAmountSearch[],
  window = AMOUNT_SEARCH_WINDOW
): {
  keywordMatches: KeywordMatchRecord[];
  scoredCandidates: ScoredAmountCandidateRecord[];
  allAmountsFound: string[];
} {
  const pageByNum = new Map(pages.map((p) => [p.pageNumber, p]));
  const keywordMatches = findAllKeywordMatches(pages, keywords);
  const scoredCandidates: ScoredAmountCandidateRecord[] = [];
  const allAmounts = new Set<string>();

  for (const hit of keywordMatches) {
    const page = pageByNum.get(hit.page);
    if (!page?.text) continue;

    const text = page.text;
    const anchor = hit.charIndex + Math.floor(hit.keyword.length / 2);
    const start = Math.max(0, hit.charIndex - window);
    const end = Math.min(text.length, hit.charIndex + hit.keyword.length + window);
    const slice = text.slice(start, end);

    const amounts = removePartialAmounts(findAllAmountsInText(slice, start));
    for (const a of amounts) allAmounts.add(a.value);

    if (!amounts.length) continue;

    for (const amount of amounts) {
      const distance = Math.abs(amount.absoluteIndex - anchor);
      const { score, breakdown } = scoreAmountCandidate({
        pageNumber: hit.page,
        distanceFromKeyword: distance,
        numericPart: amount.numericPart,
      });

      scoredCandidates.push({
        page: hit.page,
        keyword: hit.keyword,
        amount: amount.value,
        score,
        scoreBreakdown: breakdown,
        distanceFromKeyword: distance,
      });
    }
  }

  return {
    keywordMatches,
    scoredCandidates,
    allAmountsFound: Array.from(allAmounts),
  };
}

export function selectFromScoredCandidates(
  scoredCandidates: ScoredAmountCandidateRecord[],
  mode: AmountSelectMode
): ScoredAmountCandidateRecord | null {
  if (!scoredCandidates.length) return null;

  if (mode === 'largest_amount') {
    const deduped = removePartialAmounts(
      scoredCandidates.map((c) => ({
        value: c.amount,
        numericPart: c.amount.replace(/^Rs\.?\s*/i, ''),
        record: c,
      }))
    );
    const best = deduped.sort(
      (a, b) => numericValue(b.numericPart) - numericValue(a.numericPart)
    )[0];
    return best?.record ?? null;
  }

  return [...scoredCandidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.distanceFromKeyword !== b.distanceFromKeyword) {
      return a.distanceFromKeyword - b.distanceFromKeyword;
    }
    return numericValue(b.amount) - numericValue(a.amount);
  })[0];
}

export function extractAmountFieldGlobal(
  pages: Array<{ pageNumber: number; text?: string }>,
  keywords: KeywordAmountSearch[],
  selectMode: AmountSelectMode
): {
  best: AmountFieldCandidate | null;
  debug: AmountExtractionDebug;
} {
  const pageByNum = new Map(pages.map((p) => [p.pageNumber, p]));
  const { keywordMatches, scoredCandidates, allAmountsFound } = buildScoredAmountCandidates(
    pages,
    keywords
  );

  const winner = selectFromScoredCandidates(scoredCandidates, selectMode);
  const scoredWithSelection = scoredCandidates.map((c) => ({
    ...c,
    selected:
      winner != null &&
      c.page === winner.page &&
      c.keyword === winner.keyword &&
      c.amount === winner.amount &&
      c.distanceFromKeyword === winner.distanceFromKeyword,
  }));

  const debug: AmountExtractionDebug = {
    keywordFound: winner?.keyword ?? null,
    allAmountsFound,
    selectedAmount: winner?.amount ?? null,
    distanceFromKeyword: winner?.distanceFromKeyword ?? null,
    keywordMatches,
    scoredCandidates: scoredWithSelection,
  };

  if (!winner) {
    return { best: null, debug };
  }

  const page = pageByNum.get(winner.page);
  const text = page?.text || '';
  const meta = keywords.find((k) => k.label === winner.keyword);
  const matchHit = debug.keywordMatches?.find(
    (m) => m.page === winner.page && m.keyword === winner.keyword
  );
  const evidenceIdx = matchHit?.charIndex ?? 0;

  const best: AmountFieldCandidate = {
    value: winner.amount,
    sourcePage: winner.page,
    sourceText: text ? findEvidenceLine(text, evidenceIdx) : '',
    method: meta?.method ?? 'keyword',
    keywordMatched: winner.keyword,
    confidence: buildConfidence(Math.min(99, winner.score), winner.page),
    selectionScore: winner.score,
    amountDebug: debug,
  };

  return { best, debug };
}

/** Page-level label + amount block (feeds into global candidate pool). */
export function scanPageForLabelAmount(
  text: string,
  pageNumber: number,
  labels: string[],
  keywords: KeywordAmountSearch[]
): AmountFieldCandidate | null {
  const blockPattern =
    /(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5}|[0-9]{4,12})/gi;

  for (const label of labels) {
    const blockRx = new RegExp(
      `(?:${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})[\\s\\S]{0,450}?${blockPattern.source}`,
      'gi'
    );
    blockRx.lastIndex = 0;
    const m = blockRx.exec(text);
    if (!m) continue;

    const numericPart = cleanNumericPart(m[1]);
    const value = formatIndianAmount(numericPart);
    if (!validateIndianAmount(value, numericPart).valid) continue;

    const idx = m.index ?? 0;
    const distance = 0;
    const { score, breakdown } = scoreAmountCandidate({
      pageNumber,
      distanceFromKeyword: distance,
      numericPart,
    });

    const meta = keywords.find((k) => k.label === label) ?? {
      label,
      method: 'regex' as FieldLocatorMethod,
    };

    return {
      value,
      sourcePage: pageNumber,
      sourceText: findEvidenceLine(text, idx),
      method: 'regex',
      keywordMatched: label,
      confidence: buildConfidence(Math.min(99, score + 10), pageNumber),
      selectionScore: score + 10,
      amountDebug: {
        keywordFound: label,
        allAmountsFound: [value],
        selectedAmount: value,
        distanceFromKeyword: distance,
        keywordMatches: [{ page: pageNumber, keyword: label, context: snippetContext(text, idx, label.length), charIndex: idx }],
        scoredCandidates: [
          {
            page: pageNumber,
            keyword: label,
            amount: value,
            score: score + 10,
            scoreBreakdown: [...breakdown, '+10 label block match'],
            distanceFromKeyword: distance,
            selected: true,
          },
        ],
      },
    };
  }
  return null;
}

/** Merge block-scan hits with global scored search; pick winner by mode. */
export function extractAmountFieldGlobalWithBlocks(
  pages: Array<{ pageNumber: number; text?: string }>,
  keywords: KeywordAmountSearch[],
  blockLabels: string[],
  selectMode: AmountSelectMode
): { best: AmountFieldCandidate | null; debug: AmountExtractionDebug } {
  const global = extractAmountFieldGlobal(pages, keywords, selectMode);

  const blockScored: ScoredAmountCandidateRecord[] = [];
  const blockKeywordMatches: KeywordMatchRecord[] = [];
  const allAmounts = new Set(global.debug.allAmountsFound);

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;
    const block = scanPageForLabelAmount(text, page.pageNumber, blockLabels, keywords);
    if (!block) continue;
    allAmounts.add(block.value);
    if (block.amountDebug.keywordMatches) {
      blockKeywordMatches.push(...block.amountDebug.keywordMatches);
    }
    if (block.amountDebug.scoredCandidates) {
      blockScored.push(...block.amountDebug.scoredCandidates);
    }
  }

  const mergedCandidates = [
    ...(global.debug.scoredCandidates ?? []),
    ...blockScored,
  ];
  const mergedKeywords = [...(global.debug.keywordMatches ?? []), ...blockKeywordMatches];

  const winner = selectFromScoredCandidates(mergedCandidates, selectMode);
  const scoredWithSelection = mergedCandidates.map((c) => ({
    ...c,
    selected:
      winner != null &&
      c.page === winner.page &&
      c.amount === winner.amount &&
      c.keyword === winner.keyword &&
      c.distanceFromKeyword === winner.distanceFromKeyword,
  }));

  const debug: AmountExtractionDebug = {
    keywordFound: winner?.keyword ?? null,
    allAmountsFound: Array.from(allAmounts),
    selectedAmount: winner?.amount ?? null,
    distanceFromKeyword: winner?.distanceFromKeyword ?? null,
    keywordMatches: mergedKeywords,
    scoredCandidates: scoredWithSelection,
  };

  if (!winner) {
    return { best: null, debug };
  }

  const page = pages.find((p) => p.pageNumber === winner.page);
  const text = page?.text || '';
  const meta = keywords.find((k) => k.label === winner.keyword);
  const matchHit = mergedKeywords.find(
    (m) => m.page === winner.page && m.keyword === winner.keyword
  );
  const evidenceIdx = matchHit?.charIndex ?? 0;

  return {
    best: {
      value: winner.amount,
      sourcePage: winner.page,
      sourceText: text ? findEvidenceLine(text, evidenceIdx) : '',
      method: meta?.method ?? 'keyword',
      keywordMatched: winner.keyword,
      confidence: buildConfidence(Math.min(99, winner.score), winner.page),
      selectionScore: winner.score,
      amountDebug: debug,
    },
    debug,
  };
}
