import { PageText } from '../../types/intelligence';
import { DiscoveredParameter, ParameterDiscoveryResult } from '../../types/parameterDiscovery';
import { findEvidenceLine } from '../fieldLocator/fieldLocatorUtils';
import {
  buildGroupedDiscoveryPayload,
  classifyParameterGroup,
} from './parameterGroupingEngine';

export const DISCOVERY_MAX_PAGE = 15;

/** @deprecated Use classifyParameterGroup from parameterGroupingEngine */
export const classifyParameter = classifyParameterGroup;

const NOISE_LABEL =
  /^(?:page\s*no|index|schedule|sl\.?\s*no|sr\.?\s*no|particulars|description|amount|remarks|\d+)$/i;

function cleanLabel(raw: string): string | null {
  const label = raw.replace(/\s+/g, ' ').trim();
  if (label.length < 2 || label.length > 90) return null;
  if (NOISE_LABEL.test(label)) return null;
  if (!/[A-Za-z]/.test(label)) return null;
  if (/^[\d.,\s]+$/.test(label)) return null;
  return label;
}

function cleanValue(raw: string): string | null {
  let v = raw.replace(/\s+/g, ' ').trim();
  if (!v || v.length < 1) return null;
  if (v.length > 500) v = v.slice(0, 500);
  if (/^[\s|+\-=]+$/.test(v)) return null;
  return v;
}

function pageConfidence(pageNumber: number, base: number): number {
  let c = base;
  if (pageNumber <= 5) c += 8;
  else if (pageNumber <= 10) c += 5;
  else if (pageNumber <= 15) c += 2;
  return Math.min(99, c);
}

function pushParam(
  out: DiscoveredParameter[],
  seen: Set<string>,
  pageNumber: number,
  text: string,
  label: string,
  value: string,
  charIndex: number,
  baseConfidence: number
) {
  const name = cleanLabel(label);
  const val = cleanValue(value);
  if (!name || !val) return;

  const key = `${pageNumber}|${name.toLowerCase()}|${val.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);

  out.push({
    parameterName: name,
    parameterValue: val,
    pageNumber,
    sourceText: findEvidenceLine(text, charIndex),
    confidence: pageConfidence(pageNumber, baseConfidence),
    category: classifyParameterGroup(name, val),
  });
}

function scanColonDashLines(text: string, pageNumber: number, out: DiscoveredParameter[], seen: Set<string>) {
  const lines = text.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 4) {
      offset += line.length + 1;
      continue;
    }

    const colon = trimmed.match(/^(.{2,85}?)\s*:\s*(.+)$/);
    if (colon) {
      pushParam(out, seen, pageNumber, text, colon[1], colon[2], offset, 88);
    }

    const dash = trimmed.match(/^([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'-]{2,70}?)\s+-\s+(.+)$/);
    if (dash && !/^\d+\s*-\s*\d+/.test(trimmed)) {
      pushParam(out, seen, pageNumber, text, dash[1], dash[2], offset, 82);
    }

    offset += line.length + 1;
  }
}

function scanTableRows(text: string, pageNumber: number, out: DiscoveredParameter[], seen: Set<string>) {
  const rowRx = /^\|?\s*([A-Za-z][^|\n]{2,65}?)\s*\|\s*([^|\n]{1,200}?)\s*\|?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRx.exec(text))) {
    pushParam(out, seen, pageNumber, text, m[1], m[2], m.index ?? 0, 75);
  }
}

function scanInlinePairs(text: string, pageNumber: number, out: DiscoveredParameter[], seen: Set<string>) {
  const inlineRx =
    /\b([A-Z][A-Za-z0-9\s\/\(\)\.&]{2,55}?)\s{2,}([A-Za-z0-9₹Rs.,\-\s]{2,120}?)(?=\s{2,}[A-Z][A-Za-z]|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = inlineRx.exec(text))) {
    const label = m[1].trim();
    const value = m[2].trim();
    if (label.includes(':') || value.length < 2) continue;
    pushParam(out, seen, pageNumber, text, label, value, m.index ?? 0, 68);
  }
}

export function discoverParameters(
  pages: PageText[],
  opts?: { maxPage?: number }
): DiscoveredParameter[] {
  const maxPage = opts?.maxPage ?? DISCOVERY_MAX_PAGE;
  const scanPages = pages.filter((p) => p.pageNumber >= 1 && p.pageNumber <= maxPage);
  const out: DiscoveredParameter[] = [];
  const seen = new Set<string>();

  for (const page of scanPages) {
    const text = page.text || '';
    if (!text.trim()) continue;
    scanColonDashLines(text, page.pageNumber, out, seen);
    scanTableRows(text, page.pageNumber, out, seen);
    scanInlinePairs(text, page.pageNumber, out, seen);
  }

  return out.sort((a, b) => a.pageNumber - b.pageNumber || a.parameterName.localeCompare(b.parameterName));
}

export function buildDiscoveryResult(
  documentId: string,
  tenderId: string,
  pages: PageText[]
): ParameterDiscoveryResult {
  const scanPages = pages.filter((p) => p.pageNumber <= DISCOVERY_MAX_PAGE);
  const raw = discoverParameters(pages);
  const { parameters, grouped } = buildGroupedDiscoveryPayload(raw);

  return {
    documentId,
    tenderId,
    pagesScanned: scanPages.length,
    totalFound: parameters.length,
    parameters,
    grouped,
  };
}

/** Resolve EMD / Tender Value from discovered financial parameters. */
export function findAmountFromDiscovered(
  parameters: DiscoveredParameter[],
  namePatterns: RegExp[]
): string | null {
  const amountRx = /(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5})/i;
  const hits: Array<{ value: string; numeric: number; confidence: number }> = [];

  for (const p of parameters) {
    if (!namePatterns.some((rx) => rx.test(p.parameterName))) continue;
    const m = p.parameterValue.match(amountRx);
    if (!m) continue;
    const digits = m[1].replace(/,/g, '');
    hits.push({
      value: `Rs. ${m[1]}`,
      numeric: parseInt(digits, 10) || 0,
      confidence: p.confidence,
    });
  }

  if (!hits.length) return null;
  return hits.sort((a, b) => b.confidence - a.confidence)[0].value;
}

export function findLargestAmountFromDiscovered(
  parameters: DiscoveredParameter[],
  namePatterns: RegExp[]
): string | null {
  const amountRx = /(?:₹|Rs\.?|INR)\s*:?\s*([0-9]{1,3}(?:,[0-9]{2,3}){1,5})/gi;
  let best: { value: string; numeric: number } | null = null;

  for (const p of parameters) {
    if (!namePatterns.some((rx) => rx.test(p.parameterName))) continue;
    let m: RegExpExecArray | null;
    amountRx.lastIndex = 0;
    while ((m = amountRx.exec(p.parameterValue))) {
      const digits = m[1].replace(/,/g, '');
      const numeric = parseInt(digits, 10) || 0;
      const value = `Rs. ${m[1]}`;
      if (!best || numeric > best.numeric) best = { value, numeric };
    }
  }

  return best?.value ?? null;
}
