import { PageText } from '../../types/intelligence';
import {
  AmountExtractionDebug,
  FieldLocatorMethod,
  ScoredAmountCandidateRecord,
} from '../../types/fieldLocator';
import {
  formatIndianAmount,
  removePartialAmounts,
  validateIndianAmount,
  numericValue,
} from './fieldLocatorAmount';
import { findEvidenceLine, buildConfidence } from './fieldLocatorUtils';

export interface LabelSpec {
  /** Regex-safe label alternatives (longest first) */
  patterns: string[];
  priority: number;
  method?: FieldLocatorMethod;
}

export interface PairedAmountHit {
  label: string;
  labelMatched: string;
  amount: string;
  numericPart: string;
  page: number;
  charIndex: number;
  sourceText: string;
  labelPriority: number;
  method: FieldLocatorMethod;
}

const AMOUNT_SUFFIX =
  '(?:₹|Rs\\.?|INR)\\s*:?\\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5}|[0-9]{4,12})';

function escapeLabel(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLabelRegex(labels: string[]): RegExp {
  const alts = [...labels].sort((a, b) => b.length - a.length).map(escapeLabel).join('|');
  return new RegExp(
    `(?:${alts})\\s*[:–\\-]?\\s*\\n?\\s*${AMOUNT_SUFFIX}`,
    'gi'
  );
}

/** Extract amounts directly bound to labels (EMD Amount : Rs. X). */
export function extractPairedAmounts(
  pages: PageText[],
  specs: LabelSpec[]
): PairedAmountHit[] {
  const hits: PairedAmountHit[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;

    for (const spec of specs) {
      const rx = buildLabelRegex(spec.patterns);
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text))) {
        const rawNumeric = m[1] || '';
        const cleaned = rawNumeric.replace(/\s+/g, '').replace(/[^\d,]/g, '');
        const value = formatIndianAmount(cleaned);
        if (!validateIndianAmount(value, cleaned).valid) continue;

        const key = `${page.pageNumber}:${value}:${m.index}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const idx = m.index ?? 0;
        const matchedLabel = m[0].split(/[:–\-]/)[0].trim();

        hits.push({
          label: spec.patterns[0],
          labelMatched: matchedLabel,
          amount: value,
          numericPart: cleaned,
          page: page.pageNumber,
          charIndex: idx,
          sourceText: findEvidenceLine(text, idx),
          labelPriority: spec.priority,
          method: spec.method ?? 'keyword',
        });
      }
    }
  }

  return hits;
}

export const EMD_LABEL_SPECS: LabelSpec[] = [
  {
    patterns: ['EMD Amount', 'Amount of EMD', 'EMD Value'],
    priority: 1,
    method: 'keyword',
  },
  {
    patterns: ['Earnest Money Deposit', 'Earnest Money'],
    priority: 2,
    method: 'keyword',
  },
  { patterns: ['EMD'], priority: 5, method: 'keyword' },
  { patterns: ['Bid Security', 'Security Deposit'], priority: 6, method: 'alias' },
];

export const TENDER_VALUE_LABEL_SPECS: LabelSpec[] = [
  {
    patterns: ['Estimated Cost of Work', 'Estimated Cost', 'Approximate Cost of Work'],
    priority: 1,
    method: 'keyword',
  },
  {
    patterns: ['Tender Value', 'Contract Value', 'Cost of Work', 'Approximate Cost'],
    priority: 2,
    method: 'keyword',
  },
  { patterns: ['Value of Work', 'Total Estimated Cost'], priority: 4, method: 'alias' },
];

function scorePairedHit(hit: PairedAmountHit, excludeAmounts: Set<string>): number {
  if (excludeAmounts.has(hit.amount)) return -1;
  let score = 100;
  if (hit.page < 10) score += 20;
  if (hit.labelPriority <= 2) score += 15;
  if (hit.labelPriority <= 1) score += 10;
  return score;
}

function hitsToScored(
  hits: PairedAmountHit[],
  excludeAmounts: Set<string>
): ScoredAmountCandidateRecord[] {
  return hits
    .map((h) => {
      const score = scorePairedHit(h, excludeAmounts);
      if (score < 0) return null;
      return {
        page: h.page,
        keyword: h.labelMatched,
        amount: h.amount,
        score,
        scoreBreakdown: [
          '+100 direct label–value pair',
          h.page < 10 ? '+20 page < 10' : '',
          h.labelPriority <= 2 ? '+15 specific label' : '',
        ].filter(Boolean),
        distanceFromKeyword: 0,
      };
    })
    .filter((x): x is ScoredAmountCandidateRecord => x != null);
}

export function selectEmdFromPairedHits(
  pages: PageText[],
  allPages?: PageText[]
): {
  best: PairedAmountHit | null;
  debug: AmountExtractionDebug;
} {
  const searchPages = allPages ?? pages;
  const tenderHits = extractPairedAmounts(searchPages, TENDER_VALUE_LABEL_SPECS);
  const tenderAmounts = new Set(
    removePartialAmounts(
      tenderHits.map((h) => ({ value: h.amount, numericPart: h.numericPart }))
    ).map((h) => h.value)
  );

  const emdHits = extractPairedAmounts(searchPages, EMD_LABEL_SPECS);
  const filtered = emdHits.filter((h) => !tenderAmounts.has(h.amount));

  const scored = hitsToScored(filtered, tenderAmounts);
  const bestHit = [...filtered]
    .map((h) => ({ h, score: scorePairedHit(h, tenderAmounts) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.h.page !== b.h.page) return a.h.page - b.h.page;
      return a.h.labelPriority - b.h.labelPriority;
    })[0]?.h;

  const allAmounts = [...new Set(emdHits.map((h) => h.amount))];

  return {
    best: bestHit ?? null,
    debug: {
      keywordFound: bestHit?.labelMatched ?? null,
      allAmountsFound: allAmounts,
      selectedAmount: bestHit?.amount ?? null,
      distanceFromKeyword: bestHit ? 0 : null,
      keywordMatches: emdHits.map((h) => ({
        page: h.page,
        keyword: h.labelMatched,
        context: h.sourceText.slice(0, 160),
        charIndex: h.charIndex,
      })),
      scoredCandidates: scored.map((c) => ({
        ...c,
        selected: bestHit != null && c.amount === bestHit.amount && c.page === bestHit.page,
      })),
    },
  };
}

export function selectTenderValueFromPairedHits(
  pages: PageText[],
  allPages?: PageText[]
): {
  best: PairedAmountHit | null;
  debug: AmountExtractionDebug;
} {
  const searchPages = allPages ?? pages;
  const hits = extractPairedAmounts(searchPages, TENDER_VALUE_LABEL_SPECS);
  const deduped = removePartialAmounts(
    hits.map((h) => ({ value: h.amount, numericPart: h.numericPart, hit: h }))
  );

  const bestHit = deduped.sort(
    (a, b) => numericValue(b.numericPart) - numericValue(a.numericPart)
  )[0]?.hit;

  const scored: ScoredAmountCandidateRecord[] = deduped.map(({ hit, numericPart }) => ({
    page: hit.page,
    keyword: hit.labelMatched,
    amount: hit.amount,
    score: 100 + (hit.page < 10 ? 20 : 0) + numericValue(numericPart) / 1_000_000,
    scoreBreakdown: ['+100 label–value pair', hit.page < 10 ? '+20 page < 10' : 'largest amount'],
    distanceFromKeyword: 0,
    selected: bestHit != null && hit.amount === bestHit.amount && hit.page === bestHit.page,
  }));

  return {
    best: bestHit ?? null,
    debug: {
      keywordFound: bestHit?.labelMatched ?? null,
      allAmountsFound: [...new Set(hits.map((h) => h.amount))],
      selectedAmount: bestHit?.amount ?? null,
      distanceFromKeyword: bestHit ? 0 : null,
      keywordMatches: hits.map((h) => ({
        page: h.page,
        keyword: h.labelMatched,
        context: h.sourceText.slice(0, 160),
        charIndex: h.charIndex,
      })),
      scoredCandidates: scored,
    },
  };
}

export function pairedHitToFieldCandidate(hit: PairedAmountHit, debug: AmountExtractionDebug) {
  return {
    value: hit.amount,
    sourcePage: hit.page,
    sourceText: hit.sourceText,
    method: hit.method,
    keywordMatched: hit.labelMatched,
    confidence: buildConfidence(95, hit.page),
    selectionScore: 100,
    amountDebug: debug,
  };
}
