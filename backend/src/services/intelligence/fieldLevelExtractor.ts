import { ExtractedField, PageText } from '../../types/intelligence';
import {
  DATE,
  FieldValueType,
  MONEY,
  ProductionFieldDefinition,
  isDateType,
  isMoneyType,
} from './fieldDefinitions';
import {
  extractSourceSnippet,
} from './fieldContextVerifier';
import {
  filterPagesByContext,
  neighborPages,
  scorePageForField,
} from './documentPageContext';
import { DocumentMap, DocumentSectionType, documentMapBuilder } from './documentMapBuilder';
import { FieldSection } from './fieldDefinitions';
import { ExtractedTable, tableExtractionService } from './tableExtractionService';

const BOILERPLATE =
  /\b(the bidder shall|the tenderer shall|hereinafter|notwithstanding|shall not be allowed|without prejudice)\b/i;

export interface FieldCandidate {
  value: string;
  page: number;
  confidence: number;
  score: number;
  source?: 'pattern' | 'label' | 'table' | 'list' | 'synonym';
  matchStart?: number;
  sourceText?: string;
}

export interface ExtractFieldOptions {
  /** Second-pass search when field was missing on first pass. */
  recoveryPass?: boolean;
  /** Re-analyze when first result confidence is below review threshold. */
  lowConfidenceRecovery?: boolean;
  /** Annexure / schedule / appendix / form pages only. */
  annexurePass?: boolean;
  /** Skip this page (already tried). */
  excludePages?: number[];
  /** Stage 2 document map — search mapped sections first. */
  documentMap?: DocumentMap;
  /** Structured tables from tableExtractionService. */
  structuredTables?: ExtractedTable[];
}

const FIELD_SECTION_TO_DOC: Record<FieldSection, DocumentSectionType[]> = {
  general: ['notice_inviting_tender', 'general'],
  financial: ['financial', 'notice_inviting_tender', 'annexure'],
  timeline: ['bid_schedule', 'notice_inviting_tender', 'annexure'],
  eligibility: ['eligibility', 'annexure', 'technical'],
  documents: ['annexure', 'compliance'],
  technical: ['technical', 'annexure', 'scope_of_work'],
  compliance: ['compliance', 'eligibility', 'annexure'],
  risk: ['compliance', 'general', 'annexure'],
};

const REVIEW_THRESHOLD = 0.9;

function allSearchLabels(def: ProductionFieldDefinition): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of [...def.labels, ...(def.synonymLabels || [])]) {
    const k = l.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(l);
    }
  }
  return out;
}

function cleanValue(raw: string, maxLen: number): string | null {
  let t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t.length < 2) return null;
  if (/^(?:tice|tend|emen)$/i.test(t)) return null;
  if (/\b(?:should|shall)\s+be\s*$/i.test(t)) return null;
  if (/\byear\s+on\s+the\s+same\b/i.test(t)) return null;
  if (BOILERPLATE.test(t)) return null;
  if ((t.match(/[.!?]+/g) || []).length >= 2 && t.split(/\s+/).length > 25) {
    const first = t.split(/[.!?]+/)[0]?.trim();
    if (first && first.length >= 5 && first.length <= maxLen) t = first;
    else return null;
  }
  if (t.length > maxLen) t = `${t.slice(0, maxLen - 1).trim()}…`;
  return t;
}

function validateByType(value: string, type: FieldValueType): boolean {
  if (isMoneyType(type)) {
    return MONEY.test(value) || /\d+\s*%/.test(value) || /^(?:nil|na|n\/a)$/i.test(value);
  }
  if (isDateType(type)) return DATE.test(value);
  if (type === 'duration') {
    return (
      /\d+\s*(?:day|days|month|months|week|weeks|year|years)/i.test(value) ||
      /(?:period|completion|validity|tenure|duration|months?|years?)/i.test(value)
    );
  }
  return value.length >= 2 && value.length <= 500;
}

function rejectValue(value: string, def: ProductionFieldDefinition): boolean {
  if (def.rejectIfContains?.some((r) => r.test(value))) return true;
  if (!validateByType(value, def.valueType)) {
    if (def.valueType === 'list') return false;
    return true;
  }
  return false;
}

function labelWindow(def: ProductionFieldDefinition, recoveryPass?: boolean): number {
  return recoveryPass ? 90 : 60;
}

function pushCandidate(
  candidates: FieldCandidate[],
  value: string,
  pageNumber: number,
  pageText: string,
  def: ProductionFieldDefinition,
  baseScore: number,
  source: FieldCandidate['source'],
  recoveryPass?: boolean,
  matchStart?: number
): void {
  const cleaned = cleanValue(value, def.maxLength);
  if (!cleaned || rejectValue(cleaned, def)) return;
  const idx = matchStart ?? pageText.toLowerCase().indexOf(cleaned.toLowerCase());
  const start = idx >= 0 ? idx : 0;
  const page = { pageNumber, text: pageText, method: 'native' as const, charCount: pageText.length };
  candidates.push({
    value: cleaned,
    page: pageNumber,
    confidence: 0,
    score:
      baseScore +
      scorePageForField(page, def.pageHints, def.section, recoveryPass) +
      (source === 'table' ? 5 : 0),
    source,
    matchStart: start,
    sourceText: extractSourceSnippet(pageText, start, cleaned.length),
  });
}

function extractFromPageText(
  pageText: string,
  pageNumber: number,
  def: ProductionFieldDefinition,
  recoveryPass?: boolean
): FieldCandidate[] {
  const candidates: FieldCandidate[] = [];
  const labels = allSearchLabels(def);
  const win = labelWindow(def, recoveryPass);

  for (const pattern of def.patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(pageText)) !== null) {
      const raw = (m[1] ?? m[0])?.trim();
      if (!raw) continue;
      pushCandidate(candidates, raw, pageNumber, pageText, def, 10, 'pattern', recoveryPass, m.index);
    }
  }

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}[^:\\n]{0,${win}}[:\\s]+([^\\n]{2,${def.maxLength}})`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(pageText)) !== null) {
      pushCandidate(
        candidates,
        m[1],
        pageNumber,
        pageText,
        def,
        label === def.labels[0] ? 7 : 6,
        def.synonymLabels?.includes(label) ? 'synonym' : 'label',
        recoveryPass,
        m.index
      );
    }
  }

  return candidates;
}

/** Key-value rows common in tender tables (pipes, tabs, multi-space columns). */
function extractFromTables(
  pageText: string,
  pageNumber: number,
  def: ProductionFieldDefinition,
  recoveryPass?: boolean
): FieldCandidate[] {
  const candidates: FieldCandidate[] = [];
  const labels = allSearchLabels(def);

  for (const line of pageText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length < 4) continue;

    const pipeParts = trimmed
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    if (pipeParts.length >= 2) {
      const head = pipeParts[0].toLowerCase();
      for (const label of labels) {
        if (head.includes(label.toLowerCase())) {
          const val = pipeParts.slice(1).join(' ').trim();
          pushCandidate(
            candidates,
            val,
            pageNumber,
            pageText,
            def,
            9,
            'table',
            recoveryPass,
            pageText.indexOf(trimmed)
          );
        }
      }
    }

    const colonRow = trimmed.match(/^(.{3,55}?)\s*[:–-]\s*(.{2,200})$/);
    if (colonRow) {
      const head = colonRow[1].toLowerCase();
      for (const label of labels) {
        if (head.includes(label.toLowerCase())) {
          pushCandidate(
            candidates,
            colonRow[2],
            pageNumber,
            pageText,
            def,
            8,
            'table',
            recoveryPass,
            pageText.indexOf(trimmed)
          );
        }
      }
    }

    const colMatch = trimmed.match(/^(.{3,55}?)\s{2,}(.{2,200})$/);
    if (colMatch) {
      const head = colMatch[1].toLowerCase();
      for (const label of labels) {
        if (head.includes(label.toLowerCase())) {
          pushCandidate(
            candidates,
            colMatch[2],
            pageNumber,
            pageText,
            def,
            8,
            'table',
            recoveryPass,
            pageText.indexOf(trimmed)
          );
        }
      }
    }
  }

  return candidates;
}

function extractListSection(
  pageText: string,
  pageNumber: number,
  def: ProductionFieldDefinition,
  recoveryPass?: boolean
): FieldCandidate[] {
  const items: string[] = [];
  const lower = pageText.toLowerCase();
  const labels = allSearchLabels(def);

  for (const kw of labels) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const slice = pageText.slice(idx, idx + 3000);
    const lines = slice
      .split(/\n|(?:\d+\.)|(?:\([a-zivx]+\))|(?:•)|(?:\-\s)/)
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter((l) => l.length >= 5 && l.length <= def.maxLength && !BOILERPLATE.test(l));

    for (const line of lines) {
      const cleaned = cleanValue(line, def.maxLength);
      if (cleaned && !items.includes(cleaned) && items.length < (def.listMaxItems || 15)) {
        items.push(cleaned);
      }
    }
  }

  if (!items.length) return [];

  const joined = items.join(' | ');
  const kwIdx = lower.indexOf(labels[0]?.toLowerCase() || '');
  const start = kwIdx >= 0 ? kwIdx : 0;
  return [
    {
      value: joined,
      page: pageNumber,
      confidence: 0,
      score: 6 + scorePageForField(
        { pageNumber, text: pageText, method: 'native', charCount: pageText.length },
        def.pageHints,
        def.section,
        recoveryPass
      ),
      source: 'list',
      matchStart: start,
      sourceText: extractSourceSnippet(pageText, start, joined.length),
    },
  ];
}

function filterAnnexureOnlyPages(pages: PageText[]): PageText[] {
  return filterPagesByContext(pages, 'annexure', 'eligibility');
}

/** Pass 1 — Collect all rule-based candidates (no winner selection). */
export function collectAllFieldCandidates(
  def: ProductionFieldDefinition,
  pages: PageText[],
  options?: ExtractFieldOptions
): FieldCandidate[] {
  const recovery = options?.recoveryPass || options?.lowConfidenceRecovery;
  const annexureOnly = options?.annexurePass === true;

  let orderedPages = pages;
  if (annexureOnly) {
    orderedPages = filterAnnexureOnlyPages(pages);
    if (!orderedPages.length) return [];
  } else if (options?.documentMap) {
    const hints = FIELD_SECTION_TO_DOC[def.section] || ['general'];
    orderedPages = documentMapBuilder.pagesForFieldSection(options.documentMap, pages, hints);
  }

  const pageTextMap = new Map(orderedPages.map((p) => [p.pageNumber, p.text]));
  const allCandidates: FieldCandidate[] = [];

  if (options?.structuredTables?.length) {
    const pageNums = new Set(orderedPages.map((p) => p.pageNumber));
    const tables = options.structuredTables.filter((t) => pageNums.has(t.pageNumber));
    allCandidates.push(
      ...tableExtractionService.candidatesFromTables(def, tables, pageTextMap)
    );
  }

  const ranked = rankPagesForSearch(orderedPages, def, options);

  const searchSets: PageText[][] = annexureOnly
    ? [orderedPages]
    : [
        ranked,
        filterPagesByContext(orderedPages, 'section', def.section),
        filterPagesByContext(orderedPages, 'annexure', def.section),
        filterPagesByContext(orderedPages, 'table', def.section),
      ];

  if (recovery && !annexureOnly) {
    searchSets.unshift(filterPagesByContext(orderedPages, 'annexure', def.section));
    searchSets.unshift(filterPagesByContext(orderedPages, 'table', def.section));
  }

  const seenPageNums = new Set<number>();

  for (const set of searchSets) {
    const unique = set.filter((p) => {
      if (seenPageNums.has(p.pageNumber) && !recovery && !annexureOnly) return false;
      seenPageNums.add(p.pageNumber);
      return true;
    });
    if (!unique.length) continue;
    allCandidates.push(
      ...collectFromPages(unique, def, recovery, options?.structuredTables, pageTextMap)
    );
  }

  if (recovery && !annexureOnly) {
    const related = allCandidates.length
      ? neighborPages(orderedPages, allCandidates[0].page, 2)
      : orderedPages.slice(0, 3);
    allCandidates.push(
      ...collectFromPages(related, def, true, options?.structuredTables, pageTextMap)
    );
  }

  return allCandidates;
}

function collectFromPages(
  pages: PageText[],
  def: ProductionFieldDefinition,
  recoveryPass?: boolean,
  structuredTables?: ExtractedTable[],
  pageTextMap?: Map<number, string>
): FieldCandidate[] {
  const allCandidates: FieldCandidate[] = [];

  for (const page of pages) {
    allCandidates.push(...extractFromPageText(page.text, page.pageNumber, def, recoveryPass));
    allCandidates.push(...extractFromTables(page.text, page.pageNumber, def, recoveryPass));

    if (def.valueType === 'list') {
      allCandidates.push(...extractListSection(page.text, page.pageNumber, def, recoveryPass));
    }
  }

  if (structuredTables?.length && pageTextMap) {
    const pageNums = new Set(pages.map((p) => p.pageNumber));
    const tables = structuredTables.filter((t) => pageNums.has(t.pageNumber));
    allCandidates.push(...tableExtractionService.candidatesFromTables(def, tables, pageTextMap));
  }

  return allCandidates;
}

function rankPagesForSearch(
  pages: PageText[],
  def: ProductionFieldDefinition,
  options?: ExtractFieldOptions
): PageText[] {
  const exclude = new Set(options?.excludePages || []);
  const recovery = options?.recoveryPass || options?.lowConfidenceRecovery;

  const scored = pages
    .filter((p) => !exclude.has(p.pageNumber))
    .map((p) => ({
      page: p,
      score: scorePageForField(p, def.pageHints, def.section, recovery),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.page);
}

function pickBest(candidates: FieldCandidate[]): FieldCandidate | null {
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  return candidates[0];
}

function toExtractedField(best: FieldCandidate, def: ProductionFieldDefinition): ExtractedField {
  if (def.valueType === 'list' && def.id === 'requiredDocuments') {
    const items = best.value.split(/\s*\|\s*/).filter(Boolean);
    return {
      value: items.length > 1 ? items : [best.value],
      page: best.page,
      confidence: best.confidence,
    };
  }

  if (def.valueType === 'list') {
    const items = best.value.includes(' | ')
      ? best.value.split(/\s*\|\s*/)
      : [best.value];
    return {
      value: items.slice(0, def.listMaxItems || 10),
      page: best.page,
      confidence: best.confidence,
    };
  }

  return { value: best.value, page: best.page, confidence: best.confidence };
}

/**
 * Multi-strategy field extraction: main content, tables, annexures, section-focused pages.
 */
export function extractSingleField(
  def: ProductionFieldDefinition,
  pages: PageText[],
  options?: ExtractFieldOptions
): ExtractedField | null {
  const recovery = options?.recoveryPass || options?.lowConfidenceRecovery;
  const ranked = rankPagesForSearch(pages, def, options);

  const searchSets: PageText[][] = [
    ranked,
    filterPagesByContext(pages, 'section', def.section),
    filterPagesByContext(pages, 'annexure', def.section),
    filterPagesByContext(pages, 'table', def.section),
  ];

  if (recovery) {
    searchSets.unshift(filterPagesByContext(pages, 'annexure', def.section));
    searchSets.unshift(filterPagesByContext(pages, 'table', def.section));
  }

  const allCandidates: FieldCandidate[] = [];
  const seenPageNums = new Set<number>();

  for (const set of searchSets) {
    const unique = set.filter((p) => {
      if (seenPageNums.has(p.pageNumber) && !recovery) return false;
      seenPageNums.add(p.pageNumber);
      return true;
    });
    if (!unique.length) continue;
    allCandidates.push(...collectFromPages(unique, def, recovery));
  }

  let best = pickBest(allCandidates);
  if (!best) return null;

  if (best.score < 12 && !options?.lowConfidenceRecovery) {
    const related = neighborPages(pages, best.page, 2);
    const refined = collectFromPages(
      related,
      def,
      true,
      options?.structuredTables,
      new Map(pages.map((p) => [p.pageNumber, p.text]))
    );
    const better = pickBest([...allCandidates, ...refined]);
    if (better && better.score > best.score) {
      best = better;
    }
  }

  return toExtractedField(best, def);
}
