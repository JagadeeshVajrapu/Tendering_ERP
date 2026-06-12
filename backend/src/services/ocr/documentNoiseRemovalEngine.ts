import { PageText } from '../../types/intelligence';

export interface DocumentNoiseRemovalStats {
  totalPages: number;
  pagesSkippedAsIndex: number;
  linesRemoved: number;
  inlineSegmentsRemoved: number;
  charsBefore: number;
  charsAfter: number;
}

export interface DocumentNoiseRemovalResult {
  pages: PageText[];
  stats: DocumentNoiseRemovalStats;
}

/** Entire line is document noise — safe to drop. */
const NOISE_LINE_PATTERNS: RegExp[] = [
  /^page\s+\d+\s+of\s+\d+\.?\s*$/i,
  /^page\s+\d+\.?\s*$/i,
  /^page\s+no\.?\s*\d+\.?\s*$/i,
  /^-\s*\d+\s*-$/,
  /^chapter\s+\d+[\s.:–-]*$/i,
  /^section\s+\d+(?:\.\d+)*[\s.:–-]*$/i,
  /^part\s+[ivxlc\d]+[\s.:–-]*$/i,
  /^schedule\s+[a-z][\s.:–-]*$/i,
  /^annexure\s+[a-z0-9]+[\s.:–-]*$/i,
  /^appendix\s+[a-z0-9]+[\s.:–-]*$/i,
  /^enclosure\s+[ivxlc\d]+[\s.:–-]*$/i,
  /^contents\s*$/i,
  /^table\s+of\s+contents\s*$/i,
  /^index\s*$/i,
  /^sl\.?\s*no\.?\s*$/i,
  /^sr\.?\s*no\.?\s*$/i,
  /^particulars\s*$/i,
  /^description\s*$/i,
  /^note[s]?\s*$/i,
  /^continued\s*$/i,
  /^contd\.?\s*$/i,
  /^\d+\s*$/,
  /^\d+(?:\.\d+)+\.?\s*$/,
  /^\.{3,}\s*\d+\s*$/,
  /^[.\s_-]{4,}\d+\s*$/,
  /^(?:confidential|digitally\s+signed|printed\s+on|generated\s+on|download\s+ed\s+on)\b.*$/i,
  /^(?:go\s+to|click\s+here|back\s+to|next\s+page|previous\s+page)\b.*$/i,
];

/** TOC / index line: title followed by dot leaders and page number. */
const TOC_DOT_LEADER_RX = /^.{3,120}\.{2,}\s*\d+\s*$/;

/** TOC numbered entry with trailing page ref. */
const TOC_NUMBERED_ENTRY_RX = /^\d+(?:\.\d+)*\.?\s+\S.{2,80}\s+\d{1,3}\s*$/;

/** Inline segments removed from continuous OCR paragraphs. */
const INLINE_NOISE_PATTERNS: RegExp[] = [
  /\bpage\s+\d+\s+of\s+\d+\b/gi,
  /\bpage\s+no\.?\s*\d+\b/gi,
  /\bchapter\s+\d+\b/gi,
  /\bsection\s+\d+(?:\.\d+)+\b/gi,
  /\bannexure\s+[a-z0-9]+\b/gi,
  /\bappendix\s+[a-z0-9]+\b/gi,
  /\benclosure\s+[ivxlc]+\b/gi,
  /\btable\s+of\s+contents\b/gi,
];

const BUSINESS_CONTENT_RX =
  /\b(tender|nit|emd|earnest|bid|estimated\s+cost|tender\s+value|name\s+of\s+work|organization|department|rs\.?|₹|inr|deadline|submission|eligibility|turnover|experience|completion\s+period|performance\s+guarantee|scope\s+of\s+work)\b/i;

const ANNEXURE_LIST_BLOCK_RX =
  /(?:^|\n)\s*(?:annexure|appendix|enclosure)\s+[a-z0-9]+(?:\s*[,;]\s*(?:annexure|appendix|enclosure)\s+[a-z0-9]+){2,}/gi;

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/[ \u00a0]+/g, ' ').trim();
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 2) return true;

  for (const rx of NOISE_LINE_PATTERNS) {
    if (rx.test(trimmed)) return true;
  }

  if (TOC_DOT_LEADER_RX.test(trimmed)) return true;
  if (TOC_NUMBERED_ENTRY_RX.test(trimmed)) return true;

  if (/^(?:annexure|appendix|enclosure)\s+[a-z0-9]+$/i.test(trimmed)) return true;

  return false;
}

function isIndexOrTocPage(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 4) return false;

  let noiseHits = 0;
  for (const line of lines) {
    if (isNoiseLine(line)) noiseHits += 1;
    else if (TOC_DOT_LEADER_RX.test(line)) noiseHits += 1;
    else if (TOC_NUMBERED_ENTRY_RX.test(line)) noiseHits += 1;
    else if (/^contents$|^index$|^table\s+of\s+contents$/i.test(line)) noiseHits += 2;
  }

  const ratio = noiseHits / lines.length;
  if (ratio >= 0.45) return true;

  const hasContentsHeading = lines.some((l) =>
    /^(contents|index|table\s+of\s+contents)$/i.test(l)
  );
  const dotLeaderCount = lines.filter((l) => TOC_DOT_LEADER_RX.test(l)).length;
  if (hasContentsHeading && dotLeaderCount >= 2) return true;

  return false;
}

function removeInlineNoise(text: string): { text: string; removed: number } {
  let cleaned = text;
  let removed = 0;

  for (const rx of INLINE_NOISE_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(rx, ' ');
    if (cleaned !== before) removed += 1;
  }

  cleaned = cleaned.replace(ANNEXURE_LIST_BLOCK_RX, '\n');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return { text: cleaned, removed };
}

function cleanPageLines(text: string): { text: string; linesRemoved: number } {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let linesRemoved = 0;
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isNoiseLine(trimmed)) {
      linesRemoved += 1;
      continue;
    }
    kept.push(trimmed);
  }

  let joined = kept.join('\n');
  const inline = removeInlineNoise(joined);
  joined = inline.text;

  return { text: joined, linesRemoved: linesRemoved + inline.removed };
}

function detectRepeatedHeaders(pages: PageText[]): Set<string> {
  const lineCounts = new Map<string, number>();

  for (const page of pages) {
    const seenOnPage = new Set<string>();
    for (const line of (page.text || '').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 8 || trimmed.length > 120) continue;
      if (BUSINESS_CONTENT_RX.test(trimmed)) continue;
      if (isNoiseLine(trimmed)) continue;
      const key = trimmed.toLowerCase();
      if (seenOnPage.has(key)) continue;
      seenOnPage.add(key);
      lineCounts.set(key, (lineCounts.get(key) || 0) + 1);
    }
  }

  const repeated = new Set<string>();
  for (const [line, count] of lineCounts) {
    if (count >= 3) repeated.add(line);
  }
  return repeated;
}

function stripRepeatedHeaders(text: string, repeated: Set<string>): string {
  if (!repeated.size) return text;
  const lines = text.split('\n');
  const kept = lines.filter((line) => {
    const key = line.trim().toLowerCase();
    return !key || !repeated.has(key);
  });
  return kept.join('\n').trim();
}

/**
 * Remove TOC, index, headers, footers, page numbers, annexure lists,
 * clause references, and navigation text from OCR page text.
 */
export function removeDocumentNoiseFromPage(
  text: string,
  opts?: { repeatedHeaders?: Set<string>; skipIndexPages?: boolean }
): { text: string; skippedAsIndex: boolean; linesRemoved: number; inlineRemoved: number } {
  const raw = text || '';
  if (!raw.trim()) {
    return { text: '', skippedAsIndex: false, linesRemoved: 0, inlineRemoved: 0 };
  }

  if (opts?.skipIndexPages !== false && isIndexOrTocPage(raw)) {
    return { text: '', skippedAsIndex: true, linesRemoved: raw.split('\n').length, inlineRemoved: 0 };
  }

  const { text: lineCleaned, linesRemoved } = cleanPageLines(raw);
  let result = lineCleaned;

  if (opts?.repeatedHeaders?.size) {
    result = stripRepeatedHeaders(result, opts.repeatedHeaders);
  }

  result = normalizeWhitespace(result);

  if (result && !BUSINESS_CONTENT_RX.test(result) && isIndexOrTocPage(result)) {
    return { text: '', skippedAsIndex: true, linesRemoved, inlineRemoved: 0 };
  }

  return {
    text: result,
    skippedAsIndex: false,
    linesRemoved,
    inlineRemoved: 0,
  };
}

export function removeDocumentNoiseFromPages(pages: PageText[]): DocumentNoiseRemovalResult {
  const repeatedHeaders = detectRepeatedHeaders(pages);

  let charsBefore = 0;
  let charsAfter = 0;
  let linesRemoved = 0;
  let inlineSegmentsRemoved = 0;
  let pagesSkippedAsIndex = 0;

  const cleaned: PageText[] = pages.map((page) => {
    const raw = page.text || '';
    charsBefore += raw.length;

    const result = removeDocumentNoiseFromPage(raw, { repeatedHeaders });
    if (result.skippedAsIndex) pagesSkippedAsIndex += 1;
    linesRemoved += result.linesRemoved;
    inlineSegmentsRemoved += result.inlineRemoved;
    charsAfter += result.text.length;

    return {
      ...page,
      text: result.text,
      charCount: result.text.length,
    };
  });

  return {
    pages: cleaned.filter((p) => (p.text || '').trim().length > 0),
    stats: {
      totalPages: pages.length,
      pagesSkippedAsIndex,
      linesRemoved,
      inlineSegmentsRemoved,
      charsBefore,
      charsAfter,
    },
  };
}

export function getDocumentNoiseRemovalRuleSummary() {
  return {
    layer: 'document_noise_removal',
    removes: [
      'Table Of Contents',
      'Index Pages',
      'Header Text',
      'Footer Text',
      'Page Numbers',
      'Annexure Lists',
      'Clause References',
      'Navigation Text',
      'Repeated Section Titles',
    ],
    examples: [
      'Chapter 1',
      'Section 2.3',
      'Page 15 Of 90',
      'Annexure A',
      'Annexure B',
      'Contents',
    ],
    policy: 'Only business content reaches the parameter extraction engine.',
  };
}
