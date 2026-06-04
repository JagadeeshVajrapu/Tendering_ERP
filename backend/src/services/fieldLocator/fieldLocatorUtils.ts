import { PageText } from '../../types/intelligence';
import { FieldLocatorMethod } from '../../types/fieldLocator';
import { FIELD_LOCATOR_PRIORITY_PAGES } from './fieldLocatorRegistry';
import { validateFieldValue } from './fieldLocatorValidation';

export type LocatorCandidate = {
  value: string;
  sourcePage: number;
  sourceText: string;
  method: FieldLocatorMethod;
  score: number;
  confidence: number;
};

export function orderPagesForSearch(pages: PageText[]): PageText[] {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const priority = sorted.filter((p) => p.pageNumber <= FIELD_LOCATOR_PRIORITY_PAGES);
  const rest = sorted.filter((p) => p.pageNumber > FIELD_LOCATOR_PRIORITY_PAGES);
  return [...priority, ...rest];
}

export function findEvidenceLine(text: string, idx: number, maxLen = 320): string {
  const start = Math.max(0, text.lastIndexOf('\n', idx) + 1);
  const endNl = text.indexOf('\n', idx);
  const end = endNl === -1 ? text.length : endNl;
  return text.slice(start, end).trim().slice(0, maxLen);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeTenderNumber(raw: string): string {
  return raw
    .replace(/\s*\/\s*/g, '/')
    .replace(/(\d{4})\s*-\s*(\d{2})/g, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreMethod(method: FieldLocatorMethod): number {
  if (method === 'keyword') return 95;
  if (method === 'regex') return 90;
  return 85;
}

export function pagePriorityBonus(pageNumber: number): number {
  if (pageNumber <= 2) return 15;
  if (pageNumber <= FIELD_LOCATOR_PRIORITY_PAGES) return 10;
  return 0;
}

export function buildConfidence(baseScore: number, pageNumber: number): number {
  return Math.min(100, baseScore + pagePriorityBonus(pageNumber));
}

export function toCandidate(
  value: string,
  sourcePage: number,
  sourceText: string,
  method: FieldLocatorMethod,
  baseScore?: number
): LocatorCandidate | null {
  const validation = validateFieldValue(value);
  if (!validation.valid) return null;

  const score = baseScore ?? scoreMethod(method);
  return {
    value: value.trim(),
    sourcePage,
    sourceText,
    method,
    score,
    confidence: buildConfidence(score, sourcePage),
  };
}

export function pickBestCandidate(candidates: LocatorCandidate[]): LocatorCandidate | null {
  const valid = candidates.filter(Boolean);
  if (!valid.length) return null;
  return valid.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.score !== a.score) return b.score - a.score;
    return a.sourcePage - b.sourcePage;
  })[0];
}

export function cleanInlineValue(raw: string, maxLen = 120): string {
  return raw
    .replace(/^[\s:\-–]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}
