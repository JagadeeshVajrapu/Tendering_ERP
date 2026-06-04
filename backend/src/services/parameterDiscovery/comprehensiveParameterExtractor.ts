import { PageText } from '../../types/intelligence';
import { DiscoveredParameter } from '../../types/parameterDiscovery';
import { findEvidenceLine } from '../fieldLocator/fieldLocatorUtils';
import { classifyParameterGroup } from './parameterGroupingEngine';

const NOISE_LABEL =
  /^(?:page\s*no\.?|index|schedule|sl\.?\s*no\.?|sr\.?\s*no\.?|\d+)$/i;

function cleanName(raw: string): string | null {
  let name = raw
    .replace(/\s+/g, ' ')
    .replace(/^[\d]+[\.\)\]]\s*/, '')
    .replace(/^[\(\[]\d+[\)\]]\s*/, '')
    .replace(/^[\*•\-]\s*/, '')
    .trim();

  if (name.length < 2 || name.length > 110) return null;
  if (NOISE_LABEL.test(name)) return null;
  if (!/[A-Za-z]/.test(name) && !/^[A-Z]{2,8}$/.test(name)) return null;
  if (/^[\d.,\s₹RsINR]+$/i.test(name)) return null;
  return name;
}

function cleanValue(raw: string): string | null {
  let v = raw.replace(/\s+/g, ' ').trim();
  if (!v) return null;
  if (v.length > 1200) v = v.slice(0, 1200);
  if (/^[\s|+\-=_.]+$/u.test(v)) return null;
  return v;
}

function confidence(page: number, base: number): number {
  let c = base;
  if (page <= 5) c += 8;
  else if (page <= 15) c += 4;
  return Math.min(99, c);
}

function add(
  out: DiscoveredParameter[],
  seen: Set<string>,
  pageNumber: number,
  fullText: string,
  charIndex: number,
  labelRaw: string,
  valueRaw: string,
  base: number
) {
  const parameterName = cleanName(labelRaw);
  const parameterValue = cleanValue(valueRaw);
  if (!parameterName || !parameterValue) return;

  const key = `${pageNumber}|${parameterName.toLowerCase()}|${parameterValue.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);

  out.push({
    parameterName,
    parameterValue,
    pageNumber,
    sourceText: findEvidenceLine(fullText, charIndex),
    confidence: confidence(pageNumber, base),
    category: classifyParameterGroup(parameterName, parameterValue),
  });
}

function cutBeforeNextLabel(value: string): string {
  const m = value.match(
    /\s+(?=[A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{2,65}?\s*[:=\u2013\u2014\-–]\s*)/i
  );
  if (m?.index != null && m.index > 0) return value.slice(0, m.index).trim();
  return value.trim();
}

function extractChainedColons(
  line: string,
  pageNumber: number,
  fullText: string,
  lineOffset: number,
  out: DiscoveredParameter[],
  seen: Set<string>
) {
  const marker = /([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{1,95}?)\s*[:=\u2013\u2014\-–]\s*/gi;
  const hits: Array<{ label: string; start: number; valueStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(line))) {
    hits.push({
      label: m[1],
      start: m.index ?? 0,
      valueStart: (m.index ?? 0) + m[0].length,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].start : line.length;
    const value = cutBeforeNextLabel(line.slice(hits[i].valueStart, end));
    add(out, seen, pageNumber, fullText, lineOffset + hits[i].start, hits[i].label, value, 93);
  }
}

function scanLineColon(line: string, pageNumber: number, fullText: string, offset: number, out: DiscoveredParameter[], seen: Set<string>) {
  const colon = line.match(/^(.{2,100}?)\s*[:=]\s*(.+)$/);
  if (colon) {
    add(out, seen, pageNumber, fullText, offset, colon[1], cutBeforeNextLabel(colon[2]), 88);
  }
  const dash = line.match(/^([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'\-]{2,90}?)\s+-\s+(.+)$/);
  if (dash && !/^\d+\s*-\s*\d+/.test(line)) {
    add(out, seen, pageNumber, fullText, offset, dash[1], cutBeforeNextLabel(dash[2]), 84);
  }
}

function scanTabColumns(line: string, pageNumber: number, fullText: string, offset: number, out: DiscoveredParameter[], seen: Set<string>) {
  if (!line.includes('\t')) return;
  const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    add(out, seen, pageNumber, fullText, offset, parts[0], parts[1], 86);
  } else if (parts.length > 2 && parts.length % 2 === 0) {
    for (let i = 0; i < parts.length; i += 2) {
      add(out, seen, pageNumber, fullText, offset, parts[i], parts[i + 1], 82);
    }
  }
}

function scanPageLines(text: string, pageNumber: number, out: DiscoveredParameter[], seen: Set<string>) {
  const lines = text.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length >= 2) {
      extractChainedColons(trimmed, pageNumber, text, offset, out, seen);
      scanLineColon(trimmed, pageNumber, text, offset, out, seen);
      scanTabColumns(trimmed, pageNumber, text, offset, out, seen);

      const numbered = trimmed.match(
        /^(?:\d+[\.\)]\s*|[ivxlc]+[\.\)]\s*)?([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{1,95}?)\s*[:=]\s*(.+)$/i
      );
      if (numbered) {
        add(out, seen, pageNumber, text, offset, numbered[1], cutBeforeNextLabel(numbered[2]), 90);
      }

      const spaced = trimmed.match(/^([A-Za-z][^\d\n]{2,80}?)\s{2,}(.+)$/);
      if (spaced) {
        add(out, seen, pageNumber, text, offset, spaced[1], cutBeforeNextLabel(spaced[2]), 80);
      }

      const dotLead = trimmed.match(/^([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'\-]{2,80}?)[\s.]{3,}(.+)$/);
      if (dotLead) {
        add(out, seen, pageNumber, text, offset, dotLead[1], dotLead[2], 78);
      }

      const pipe = trimmed.match(/^\|?\s*([^|]{2,80}?)\s*\|\s*([^|]{1,500}?)\s*\|?\s*$/);
      if (pipe && !/^(sr|s\.no|particulars)$/i.test(pipe[1].trim())) {
        add(out, seen, pageNumber, text, offset, pipe[1], pipe[2], 84);
      }
    }
    offset += line.length + 1;
  }
}

function scanGlobalKeyValue(text: string, pageNumber: number, out: DiscoveredParameter[], seen: Set<string>) {
  const globalRx =
    /([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{1,90}?)\s*[:=\u2013\u2014\-–]\s*([^:\n]{1,400}?)(?=\s+[A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{2,35}?\s*[:=\u2013\u2014\-–]|\n\n|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = globalRx.exec(text))) {
    add(out, seen, pageNumber, text, m.index ?? 0, m[1], cutBeforeNextLabel(m[2]), 72);
  }
}

/** All pages, all patterns, unlimited pair count. */
export function extractAllParametersFromPages(
  pages: PageText[],
  opts?: { maxPage?: number | null }
): DiscoveredParameter[] {
  const maxPage = opts?.maxPage === null ? Infinity : (opts?.maxPage ?? Infinity);
  const scanPages = pages.filter((p) => p.pageNumber >= 1 && p.pageNumber <= maxPage);
  const out: DiscoveredParameter[] = [];
  const seen = new Set<string>();

  for (const page of scanPages) {
    const text = page.text || '';
    if (!text.trim()) continue;
    scanPageLines(text, page.pageNumber, out, seen);
    scanGlobalKeyValue(text, page.pageNumber, out, seen);
  }

  return out.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      a.parameterName.localeCompare(b.parameterName) ||
      a.parameterValue.localeCompare(b.parameterValue)
  );
}
