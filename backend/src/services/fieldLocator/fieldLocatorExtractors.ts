import { PageText } from '../../types/intelligence';
import {
  FieldLocatorFailure,
  FieldLocatorFieldName,
  FieldLocatorMethod,
  FieldLocatorResult,
} from '../../types/fieldLocator';
import {
  ORGANIZATION_ALIASES,
  ORGANIZATION_KEYWORDS,
  ORGANIZATION_MARKERS,
  ORGANIZATION_REGEX,
  TENDER_NUMBER_ALIASES,
  TENDER_NUMBER_KEYWORDS,
  TENDER_NUMBER_LABEL_REGEX,
  TENDER_NUMBER_REGEX,
  TENDER_VALUE_ALIASES,
  TENDER_VALUE_KEYWORDS,
} from './fieldLocatorRegistry';
import {
  cleanInlineValue,
  escapeRegex,
  findEvidenceLine,
  LocatorCandidate,
  normalizeTenderNumber,
  orderPagesForSearch,
  pickBestCandidate,
  scoreMethod,
  toCandidate,
} from './fieldLocatorUtils';
import { extractEmdFromPages } from './fieldLocatorEmd';
import { extractWorkNameFromPages } from './fieldLocatorWorkName';
import { extractTenderValueFromPages } from './fieldLocatorTenderValue';
import { FieldLocatorRunOptions } from './fieldLocatorOptions';

import { validateFieldValue } from './fieldLocatorValidation';

export type ExtractorOutcome = {
  field: FieldLocatorResult | null;
  failure: FieldLocatorFailure | null;
};

function failure(
  fieldName: FieldLocatorFieldName,
  pagesSearched: number,
  regexUsed: string[],
  aliasesUsed: string[],
  failureReason: string
): ExtractorOutcome {
  return {
    field: null,
    failure: {
      fieldName,
      pagesSearched,
      regexUsed,
      aliasesUsed,
      failureReason,
    },
  };
}

function candidateToField(
  fieldName: FieldLocatorFieldName,
  c: LocatorCandidate
): FieldLocatorResult {
  return {
    fieldName,
    value: c.value,
    sourcePage: c.sourcePage,
    sourceText: c.sourceText,
    extractionMethod: c.method,
    confidence: c.confidence,
  };
}

function extractByLabelPatterns(
  text: string,
  pageNumber: number,
  labels: string[],
  method: FieldLocatorMethod,
  maxLen: number
): LocatorCandidate[] {
  const out: LocatorCandidate[] = [];
  for (const label of labels) {
    const rx = new RegExp(
      `\\b${escapeRegex(label)}\\b\\s*[:\\-–]\\s*([^\\n|]{2,${Math.min(maxLen, 200)}})`,
      'gi'
    );
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const c = toCandidate(
        cleanInlineValue(m[1] || '', maxLen),
        pageNumber,
        findEvidenceLine(text, m.index ?? 0),
        method
      );
      if (c) out.push(c);
      if (out.length >= 6) break;
    }
  }
  return out;
}

function extractByRegexPatterns(
  text: string,
  pageNumber: number,
  patterns: string[],
  maxLen: number,
  transform?: (v: string) => string
): LocatorCandidate[] {
  const out: LocatorCandidate[] = [];
  for (const p of patterns) {
    let rx: RegExp;
    try {
      rx = new RegExp(p, 'gi');
    } catch {
      continue;
    }
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const raw = (m[1] || m[0] || '').trim();
      const value = transform ? transform(raw) : cleanInlineValue(raw, maxLen);
      const c = toCandidate(value, pageNumber, findEvidenceLine(text, m.index ?? 0), 'regex');
      if (c) out.push(c);
      if (out.length >= 8) break;
    }
  }
  return out;
}

export function extractTenderNumber(
  pages: PageText[],
  _options?: FieldLocatorRunOptions
): ExtractorOutcome {
  const fieldName = 'Tender Number' as const;
  const ordered = orderPagesForSearch(pages);
  const regexUsed = [...TENDER_NUMBER_LABEL_REGEX, TENDER_NUMBER_REGEX.source];
  const aliasesUsed = [...TENDER_NUMBER_KEYWORDS, ...TENDER_NUMBER_ALIASES];
  const candidates: LocatorCandidate[] = [];
  let rejected = 0;

  for (const page of ordered) {
    const text = page.text || '';
    if (!text.trim()) continue;

    candidates.push(
      ...extractByRegexPatterns(text, page.pageNumber, regexUsed, 120, normalizeTenderNumber)
    );
    for (const c of extractByLabelPatterns(
      text,
      page.pageNumber,
      TENDER_NUMBER_KEYWORDS,
      'keyword',
      120
    )) {
      const v = toCandidate(
        normalizeTenderNumber(c.value),
        c.sourcePage,
        c.sourceText,
        c.method,
        c.score
      );
      if (v) candidates.push(v);
    }
    for (const c of extractByLabelPatterns(
      text,
      page.pageNumber,
      TENDER_NUMBER_ALIASES,
      'alias',
      120
    )) {
      const v = toCandidate(
        normalizeTenderNumber(c.value),
        c.sourcePage,
        c.sourceText,
        c.method,
        c.score
      );
      if (v) candidates.push(v);
    }

    TENDER_NUMBER_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TENDER_NUMBER_REGEX.exec(text))) {
      const value = normalizeTenderNumber(m[0]);
      const vCheck = validateFieldValue(value);
      if (!vCheck.valid) {
        rejected++;
        continue;
      }
      const c = toCandidate(value, page.pageNumber, findEvidenceLine(text, m.index ?? 0), 'regex', 92);
      if (c) candidates.push(c);
    }
  }

  const best = pickBestCandidate(candidates);
  if (best) return { field: candidateToField(fieldName, best), failure: null };

  return failure(
    fieldName,
    pages.length,
    regexUsed,
    aliasesUsed,
    rejected > 0
      ? `Tender number pattern seen but ${rejected} candidate(s) failed validation`
      : 'No tender number matched tolerant slash-separated ID or label patterns'
  );
}

export function extractOrganization(
  pages: PageText[],
  _options?: FieldLocatorRunOptions
): ExtractorOutcome {
  const fieldName = 'Organization' as const;
  const ordered = orderPagesForSearch(pages);
  const regexUsed = [...ORGANIZATION_REGEX];
  const aliasesUsed = [...ORGANIZATION_MARKERS, ...ORGANIZATION_KEYWORDS, ...ORGANIZATION_ALIASES];
  const candidates: LocatorCandidate[] = [];

  for (const page of ordered) {
    const text = page.text || '';
    if (!text.trim()) continue;

    for (const p of ORGANIZATION_REGEX) {
      const rx = new RegExp(p, 'gi');
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text))) {
        let value = 'CSIR - Central Road Research Institute';
        if (m[1] && m[2]) {
          const a = m[1].trim();
          const b = m[2].trim();
          if (/central\s+road/i.test(b)) value = `${a} - ${b}`;
          else if (/csir/i.test(a)) value = `${a} - Central Road Research Institute`;
          else value = `${a} - ${b}`;
        }
        const c = toCandidate(value, page.pageNumber, findEvidenceLine(text, m.index ?? 0), 'regex', 94);
        if (c) candidates.push(c);
      }
    }

    const upper = text.toUpperCase();
    const hasCsir = upper.includes('CSIR');
    const hasCrri = /\bCRRI\b/.test(upper);
    const hasInstitute = /central\s+road\s+research\s+institute/i.test(text);

    if (hasCsir && hasInstitute) {
      const idx = text.search(/CSIR/i);
      const c = toCandidate(
        'CSIR - Central Road Research Institute',
        page.pageNumber,
        findEvidenceLine(text, idx >= 0 ? idx : 0),
        'keyword',
        93
      );
      if (c) candidates.push(c);
    } else if (hasCrri && hasInstitute) {
      const idx = text.search(/CRRI/i);
      const c = toCandidate(
        'CSIR - Central Road Research Institute',
        page.pageNumber,
        findEvidenceLine(text, idx >= 0 ? idx : 0),
        'alias',
        88
      );
      if (c) candidates.push(c);
    }

    for (const marker of ORGANIZATION_MARKERS) {
      const idx = text.indexOf(marker);
      if (idx < 0) continue;
      const line = findEvidenceLine(text, idx);
      if (marker === 'Central Road Research Institute') {
        const c = toCandidate(
          'CSIR - Central Road Research Institute',
          page.pageNumber,
          line,
          'alias',
          86
        );
        if (c) candidates.push(c);
      }
    }

    candidates.push(
      ...extractByLabelPatterns(text, page.pageNumber, ORGANIZATION_KEYWORDS, 'keyword', 150)
    );
  }

  const best = pickBestCandidate(candidates);
  if (best) return { field: candidateToField(fieldName, best), failure: null };

  return failure(
    fieldName,
    pages.length,
    regexUsed,
    aliasesUsed,
    'CSIR / CRRI / Central Road Research Institute not found on any page'
  );
}

export function extractTenderValue(
  pages: PageText[],
  options?: FieldLocatorRunOptions
): ExtractorOutcome {
  const { field, failure } = extractTenderValueFromPages(pages, options);
  if (field) return { field, failure: null };
  return { field: null, failure: failure! };
}

export function extractEmd(pages: PageText[], options?: FieldLocatorRunOptions): ExtractorOutcome {
  const { field, failure } = extractEmdFromPages(pages, options);
  if (field) return { field, failure: null };
  return { field: null, failure: failure! };
}

export function extractNameOfWork(
  pages: PageText[],
  _options?: FieldLocatorRunOptions
): ExtractorOutcome {
  const { field, failure } = extractWorkNameFromPages(pages);
  if (field) return { field, failure: null };
  return { field: null, failure: failure! };
}
