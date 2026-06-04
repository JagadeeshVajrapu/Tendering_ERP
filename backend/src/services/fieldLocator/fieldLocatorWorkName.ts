import { PageText } from '../../types/intelligence';
import { FieldLocatorFailure, FieldLocatorResult, FieldLocatorMethod } from '../../types/fieldLocator';
import { orderPagesForSearch, findEvidenceLine, scoreMethod, buildConfidence, toCandidate } from './fieldLocatorUtils';

const CAPTURE_CHARS = 500;

/** Longest first so "Description of Work" wins over "Work". */
const WORK_SEARCH_LABELS = [
  'Name of Work',
  'NAME OF WORK',
  'Nature of Work',
  'Scope of Work',
  'Description of Work',
  'Work Name',
  'Work Title',
  'Title of Work',
  'Name of the Work',
  'Subject of Tender',
  'Subject of Work',
];

const STOP_MARKERS: RegExp[] = [
  /Tender\s+Publishing\s+Date/i,
  /\bEMD\b/i,
  /Estimated\s+Cost/i,
  /Bid\s+Start\s+Date/i,
  /Table\s+Border/i,
  /\+[-=+]+\+/,
  /\|[-\s|]+\|/,
];

const NOISE_LINE = /^(?:Page\s+Number|Index|Tender\s+Schedule)\b/i;

function validateWorkName(value: string): boolean {
  const v = value.trim();
  if (v.length < 8 || v.length > 500) return false;
  if (v.split(/\s+/).length > 80) return false;
  const lower = v.toLowerCase();
  if (lower.includes('i agree to abide') || lower.includes('terms and conditions')) return false;
  return true;
}

function cleanWorkNameText(raw: string): string {
  let text = raw;

  for (const noise of [/Page\s+Number/gi, /\bIndex\b/gi, /Tender\s+Schedule/gi]) {
    text = text.replace(noise, ' ');
  }

  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !NOISE_LINE.test(l))
    .join(' ')
    .replace(/[,–—\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtStopMarkers(chunk: string): string {
  let end = chunk.length;
  for (const stop of STOP_MARKERS) {
    stop.lastIndex = 0;
    const m = stop.exec(chunk);
    if (m && m.index >= 0 && m.index < end) {
      end = m.index;
    }
  }
  return chunk.slice(0, end);
}

/** Capture up to 500 chars after label, including following lines until a stop marker. */
function extractBlockAfterLabel(text: string, labelIndex: number, labelLength: number): string | null {
  let start = labelIndex + labelLength;
  const tail = text.slice(start);
  const skip = tail.match(/^[\s:.\-–—]*/);
  start += skip?.[0].length ?? 0;

  const chunk = text.slice(start, start + CAPTURE_CHARS);
  if (!chunk.trim()) return null;

  const truncated = truncateAtStopMarkers(chunk);
  const cleaned = cleanWorkNameText(truncated);
  return cleaned.length >= 8 ? cleaned : null;
}

function findLabelPositions(text: string): Array<{ index: number; length: number; label: string }> {
  const lower = text.toLowerCase();
  const hits: Array<{ index: number; length: number; label: string }> = [];

  for (const label of WORK_SEARCH_LABELS) {
    const lowerLabel = label.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(lowerLabel, from);
      if (idx < 0) break;

      const before = idx === 0 || !/\w/.test(text[idx - 1]);
      const afterIdx = idx + label.length;
      const after = afterIdx >= text.length || !/\w/.test(text[afterIdx]);
      if (before && after) {
        hits.push({ index: idx, length: label.length, label });
      }
      from = idx + 1;
    }
  }

  return hits.sort((a, b) => a.index - b.index);
}

function extractFromPage(text: string, pageNumber: number): Array<{
  value: string;
  sourceText: string;
  method: FieldLocatorMethod;
  score: number;
}> {
  const out: Array<{ value: string; sourceText: string; method: FieldLocatorMethod; score: number }> = [];

  for (const { index, length, label } of findLabelPositions(text)) {
    const value = extractBlockAfterLabel(text, index, length);
    if (!value || !validateWorkName(value)) continue;

    const method: FieldLocatorMethod =
      label.toLowerCase() === 'name of work' || label === 'NAME OF WORK' ? 'keyword' : 'alias';

    out.push({
      value,
      sourceText: findEvidenceLine(text, index),
      method,
      score: label.toLowerCase().includes('name of work') ? 95 : scoreMethod(method),
    });
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (
      (upper.includes('MANPOWER') || upper.includes('PROVIDING')) &&
      upper.includes('SERVICE') &&
      line.length >= 15 &&
      line.length <= 300
    ) {
      const value = cleanWorkNameText(line);
      if (!validateWorkName(value)) continue;
      out.push({
        value,
        sourceText: line.slice(0, 320),
        method: 'keyword',
        score: 75,
      });
    }
  }

  return out;
}

export function extractWorkNameFromPages(pages: PageText[]): {
  field: FieldLocatorResult | null;
  failure: FieldLocatorFailure | null;
} {
  const fieldName = 'Name of Work' as const;
  const ordered = orderPagesForSearch(pages);
  const candidates: Array<{
    value: string;
    sourcePage: number;
    sourceText: string;
    method: FieldLocatorMethod;
    confidence: number;
  }> = [];

  for (const page of ordered) {
    const text = page.text || '';
    if (!text.trim()) continue;
    for (const hit of extractFromPage(text, page.pageNumber)) {
      const c = toCandidate(hit.value, page.pageNumber, hit.sourceText, hit.method, hit.score);
      if (c) {
        candidates.push({
          value: c.value,
          sourcePage: c.sourcePage,
          sourceText: c.sourceText,
          method: c.method,
          confidence: c.confidence,
        });
      }
    }
  }

  if (candidates.length) {
    const best = candidates.sort(
      (a, b) => b.confidence - a.confidence || b.value.length - a.value.length || a.sourcePage - b.sourcePage
    )[0];
    return {
      field: {
        fieldName,
        value: best.value,
        sourcePage: best.sourcePage,
        sourceText: best.sourceText,
        extractionMethod: best.method,
        confidence: best.confidence,
      },
      failure: null,
    };
  }

  return {
    field: null,
    failure: {
      fieldName,
      pagesSearched: pages.length,
      regexUsed: WORK_SEARCH_LABELS,
      aliasesUsed: WORK_SEARCH_LABELS,
      failureReason: 'No work name label block matched (multiline capture after Name of Work / Scope of Work)',
    },
  };
}
