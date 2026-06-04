import { PageText } from '../../types/intelligence';
import { OcrNormalizedRecord } from '../../types/ocrNormalization';

const LABEL_MARKER =
  /(?:^|\n)\s*([A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{2,95}?)\s*[:=\u2013\u2014\-–]\s*/g;

const NOISE_LABEL =
  /^(?:page\s*no\.?|index|schedule|sl\.?\s*no\.?|sr\.?\s*no\.?|particulars|description|\d+)$/i;

const LABEL_MAX_LEN = 95;
const LABEL_MIN_LEN = 2;
const VALUE_MAX_LEN = 2000;
const VALUE_MIN_LEN = 1;

function collapseValue(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLabel(raw: string): string | null {
  let label = raw
    .replace(/\s+/g, ' ')
    .replace(/^[\d]+[\.\)\]]\s*/, '')
    .replace(/^[\(\[]\d+[\)\]]\s*/, '')
    .replace(/^[\*•\-]\s*/, '')
    .trim();

  if (label.length < LABEL_MIN_LEN || label.length > LABEL_MAX_LEN) return null;
  if (NOISE_LABEL.test(label)) return null;
  if (!/[A-Za-z]/.test(label)) return null;
  if (/^[\d.,\s₹RsINR]+$/i.test(label)) return null;
  if ((label.match(/\s/g)?.length ?? 0) > 12) return null;

  return label;
}

function cleanValue(raw: string): string | null {
  const value = collapseValue(raw);
  if (value.length < VALUE_MIN_LEN || value.length > VALUE_MAX_LEN) return null;
  if (/^[\s|+\-=_.]+$/u.test(value)) return null;
  return value;
}

function evidenceSnippet(text: string, start: number, label: string, value: string): string {
  const slice = text.slice(Math.max(0, start), start + 200);
  const line = slice.split('\n')[0]?.trim();
  if (line && line.length > 10) return line.slice(0, 180);
  return `${label}: ${value}`.slice(0, 180);
}

/**
 * Split OCR page text (including multi-line paragraphs) into label → value records.
 * Handles:
 *   Name of Work:\nProviding Manpower...
 *   EMD: Rs. 33,59,315
 *   Estimated Cost:\nRs. 16,79,65,742
 */
export function normalizePageText(text: string, pageNumber: number): OcrNormalizedRecord[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  if (!normalized.trim()) return [];

  const hits: Array<{ label: string; valueStart: number; matchStart: number }> = [];
  let m: RegExpExecArray | null;
  LABEL_MARKER.lastIndex = 0;

  while ((m = LABEL_MARKER.exec(normalized))) {
    const label = cleanLabel(m[1]);
    if (!label) continue;
    hits.push({
      label,
      valueStart: (m.index ?? 0) + m[0].length,
      matchStart: m.index ?? 0,
    });
  }

  const records: OcrNormalizedRecord[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].matchStart : normalized.length;
    const valueRaw = normalized.slice(hits[i].valueStart, end);
    const value = cleanValue(valueRaw);
    if (!value) continue;

    const key = `${pageNumber}|${hits[i].label.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({
      label: hits[i].label,
      value,
      page: pageNumber,
      sourceText: evidenceSnippet(normalized, hits[i].matchStart, hits[i].label, value),
    });
  }

  return records;
}

/** Normalize all OCR pages into structured label–value records. */
export function normalizeOcrPages(pages: PageText[]): OcrNormalizedRecord[] {
  const all: OcrNormalizedRecord[] = [];
  const globalSeen = new Set<string>();

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;

    for (const rec of normalizePageText(text, page.pageNumber)) {
      const key = `${rec.page}|${rec.label.toLowerCase()}|${rec.value.toLowerCase()}`;
      if (globalSeen.has(key)) continue;
      globalSeen.add(key);
      all.push(rec);
    }
  }

  return all.sort(
    (a, b) =>
      a.page - b.page || a.label.localeCompare(b.label) || a.value.localeCompare(b.value)
  );
}
