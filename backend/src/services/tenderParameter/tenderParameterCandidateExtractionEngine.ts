import { PageText } from '../../types/intelligence';
import {
  RawTenderParameterCandidateRow,
  TenderParameterExtractionMetadata,
} from '../../types/tenderParameterCandidateExtraction';
import { geminiGenerateJson, isGeminiConfigured, isGeminiApiError, readGeminiModel } from '../ai/geminiClient';
import { openaiService } from '../ai/openaiService';
import { env } from '../../config/env';
import { getOpenAIClient, isOpenAIApiError } from '../ai/openaiClient';
import { isQuotaBlocked, markQuotaExceeded } from '../ai/aiQuotaGuard';
import { matchesTenderTypeLibraryParameter } from '../tenderIntelligence/enterpriseTenderTypeLibraryEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import {
  cleanExtractedParameterValue,
  isContractClauseLabel,
  isGarbageTenderParameterValue,
  isGenuineTenderParameterRow,
  isPageHeaderOrEnclosureLabel,
} from './tenderParameterQualityEngine';
import { validateStrictParameterRow } from './strictValueValidationEngine';
import {
  buildCandidateExtractionSystemPrompt,
  buildCandidateExtractionUserPrompt,
} from './tenderParameterAiExtractionPrompt';
import {
  orderPagesForPriorityExtraction,
  resolvePagePriorityAnalysis,
  scorePagePriorityForCandidate,
} from './enterprisePagePriorityEngine';

export const MIN_EXTRACTION_CONFIDENCE = 55;

export const CANDIDATE_EXTRACTION_CHUNK_SIZE = 10;
const MAX_OCR_CHARS_PER_CHUNK = 48_000;

/** @deprecated Use buildCandidateExtractionSystemPrompt() */
export const CANDIDATE_EXTRACTION_SYSTEM = buildCandidateExtractionSystemPrompt();

const IGNORE_PARAMETER_RX =
  /^(?:annexure|index|table\s+of\s+contents|checklist|integrity\s+pact|declaration\s+form|page\s+number|footer|header|schedule\s+[a-z]|section\s+\d|ii\s+page|particulars|sl\.?\s*no|sr\.?\s*no|check\s*l?|enclosure|complaint\s+form|register)$/i;

const PAGE_HEADER_PARAMETER_RX = /\bpage\s+\d+\s+of\s+\d+\b/i;

function isNullValue(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim().toLowerCase();
  return !s || s === 'null' || s === 'n/a' || s === 'na' || s === 'not found' || s === '-';
}

/** Preserve OCR value exactly — trim edges only, no reformatting. */
function preserveExactValue(value: unknown): string {
  return String(value ?? '').replace(/^\s+|\s+$/g, '');
}

function parsePageNumber(raw: unknown, fallback: number): number {
  const n = Number(String(raw ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseConfidence(raw: unknown): number | null {
  const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function computeCandidateConfidence(
  aiConfidence: number | null,
  parameter: string,
  value: string,
  sourceText: string,
  pageText: string,
  tenderType?: string
): number {
  let score =
    aiConfidence != null && aiConfidence >= 50
      ? aiConfidence
      : (() => {
          let base = 72;
          if (valueAppearsInPage(value, pageText)) base += 12;
          if (valueAppearsInPage(sourceText.slice(0, 200), pageText)) base += 8;
          if (isAllowedMasterParameter(parameter)) base += 8;
          if (/\d/.test(value)) base += 3;
          return base;
        })();

  if (tenderType && matchesTenderTypeLibraryParameter(parameter, tenderType)) {
    score = Math.min(100, score + 20);
  }

  return Math.min(98, score);
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function valueAppearsInPage(value: string, pageText: string): boolean {
  const v = normalizeForMatch(value);
  const page = normalizeForMatch(pageText);
  if (!v) return true;
  if (!page) return true;
  if (page.includes(v)) return true;

  const compactValue = v.replace(/[,\s₹.]/g, '');
  const compactPage = page.replace(/[,\s₹.]/g, '');
  if (compactValue.length >= 3 && compactPage.includes(compactValue)) return true;

  const digitRuns = v.match(/\d[\d,.]*/g) || [];
  for (const run of digitRuns) {
    const digits = run.replace(/[^\d]/g, '');
    if (digits.length >= 2 && compactPage.includes(digits)) return true;
  }

  const words = v.split(/\s+/).filter((w) => w.length >= 4);
  if (words.length >= 2) {
    const hits = words.filter((w) => page.includes(w)).length;
    if (hits >= Math.ceil(words.length * 0.6)) return true;
  }

  return false;
}

function parseBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'true' || s === 'yes' || s === '1') return true;
  if (s === 'false' || s === 'no' || s === '0') return false;
  return undefined;
}

function parseCategory(raw: unknown): string | undefined {
  const s = String(raw ?? '').trim();
  return s || undefined;
}

function isAcceptableParameterLabel(parameter: string): boolean {
  if (isContractClauseLabel(parameter)) return false;
  if (isPageHeaderOrEnclosureLabel(parameter)) return false;
  if (!/[A-Za-z0-9]/.test(parameter)) return false;
  if (parameter.length < 2 || parameter.length > 80) return false;
  const words = parameter.split(/\s+/).filter(Boolean);
  if (words.length > 10) return false;
  return true;
}

export function buildCandidateChunkPayload(
  pages: PageText[],
  pageClassifications?: Array<{ page: number; sections: Array<{ section: string; confidence: number }> }>
): string {
  const classMap = new Map(pageClassifications?.map((p) => [p.page, p.sections]) || []);

  return pages
    .map((p) => {
      const tags = classMap.get(p.pageNumber);
      const sectionLine = tags?.length
        ? `[SECTIONS: ${tags.map((t) => `${t.section}(${t.confidence}%)`).join(', ')}]\n`
        : '';
      return `[PAGE ${p.pageNumber}]\n${sectionLine}${(p.text || '').trim()}\n`;
    })
    .join('\n');
}

/** Split pages into groups that each fit within the OCR char budget (no silent truncation). */
export function splitPagesByOcrCharLimit(
  pages: PageText[],
  maxChars = MAX_OCR_CHARS_PER_CHUNK
): PageText[][] {
  const groups: PageText[][] = [];
  let current: PageText[] = [];
  let total = 0;

  for (const p of pages) {
    const blockLen = `[PAGE ${p.pageNumber}]\n${(p.text || '').trim()}\n`.length;
    if (current.length && total + blockLen > maxChars) {
      groups.push(current);
      current = [];
      total = 0;
    }
    current.push(p);
    total += blockLen;
  }

  if (current.length) groups.push(current);
  return groups.length ? groups : [pages];
}

export function splitCandidatePageChunks(pages: PageText[]): PageText[][] {
  const ordered = orderPagesForPriorityExtraction(pages);
  const chunks: PageText[][] = [];
  for (let i = 0; i < ordered.length; i += CANDIDATE_EXTRACTION_CHUNK_SIZE) {
    chunks.push(ordered.slice(i, i + CANDIDATE_EXTRACTION_CHUNK_SIZE));
  }
  return chunks;
}

export function parseCandidateChunkResponse(
  raw: string,
  chunkPages: PageText[],
  opts?: { tenderType?: string }
): RawTenderParameterCandidateRow[] {
  const pageMap = new Map(chunkPages.map((p) => [p.pageNumber, p.text]));
  const allowedPages = new Set(chunkPages.map((p) => p.pageNumber));
  const minPage = chunkPages[0]?.pageNumber ?? 1;
  const maxPage = chunkPages[chunkPages.length - 1]?.pageNumber ?? minPage;

  let parsed: { parameters?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { parameters?: unknown[] };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    parsed = JSON.parse(match[0]) as { parameters?: unknown[] };
  }

  if (!Array.isArray(parsed.parameters)) return [];

  const rows: RawTenderParameterCandidateRow[] = [];
  const seen = new Set<string>();

  for (const item of parsed.parameters) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const parameter = String(row.parameter ?? '').trim();
    if (!parameter || parameter.length > 200 || !/[A-Za-z0-9]/.test(parameter)) continue;
    if (IGNORE_PARAMETER_RX.test(parameter)) continue;
    if (!isAcceptableParameterLabel(parameter)) continue;
    if (PAGE_HEADER_PARAMETER_RX.test(parameter) || isPageHeaderOrEnclosureLabel(parameter)) continue;
    if (parameter.length > 200) continue;
    if (isNullValue(row.value)) continue;

    const isCoreHint = parseBoolean(row.isCoreParameter) ?? isAllowedMasterParameter(parameter);
    let value = cleanExtractedParameterValue(preserveExactValue(row.value), parameter, isCoreHint);
    if (!value || isGarbageTenderParameterValue(value, { isCore: isCoreHint })) continue;
    if (/^page\s+\d/i.test(parameter) || /^ii\s+page/i.test(parameter)) continue;

    let page = parsePageNumber(row.page ?? row.pageNumber ?? row.sourcePage, minPage);
    if (!allowedPages.has(page) && (page < minPage || page > maxPage)) {
      page = minPage;
    }

    const sourceText = preserveExactValue(row.sourceText ?? `${parameter}: ${value}`);
    const pageText = pageMap.get(page) ?? '';
    const allChunkText = chunkPages.map((p) => p.text || '').join('\n');

    const confidence = computeCandidateConfidence(
      parseConfidence(row.confidence),
      parameter,
      value,
      sourceText,
      pageText || allChunkText,
      opts?.tenderType
    );
    if (confidence < MIN_EXTRACTION_CONFIDENCE) continue;

    const skipPageVerify = confidence >= 75 || sourceText.length >= 10;
    const valueInChunk =
      valueAppearsInPage(value, allChunkText) ||
      valueAppearsInPage(sourceText.slice(0, 200), allChunkText) ||
      valueAppearsInPage(`${parameter} ${value}`, allChunkText);

    if (
      !skipPageVerify &&
      !valueInChunk &&
      pageText &&
      !valueAppearsInPage(value, pageText) &&
      !valueAppearsInPage(sourceText.slice(0, 200), pageText) &&
      !valueAppearsInPage(`${parameter} ${value}`, pageText)
    ) {
      continue;
    }

    const category = parseCategory(row.category);
    const isCoreParameter = isCoreHint;

    const candidateRow = {
      parameter,
      originalLabel: parameter,
      value,
      page,
      confidence,
      sourceText,
      category,
      isCoreParameter,
    };

    if (!isCoreParameter && !isGenuineTenderParameterRow(candidateRow)) continue;

    const strict = validateStrictParameterRow(undefined, parameter, value, sourceText);
    if (strict?.status === 'REJECT') continue;

    const key = `${page}|${parameter.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pageAnalysis = resolvePagePriorityAnalysis(page, pageText, sourceText);
    rows.push({
      parameter,
      value,
      page,
      confidence,
      sourceText,
      category,
      isCoreParameter,
      pagePriority: scorePagePriorityForCandidate(
        { page, parameter, sourceText },
        pageText
      ),
      priorityTier: pageAnalysis.priorityTier,
      sourceSection: pageAnalysis.sourceSection,
    });
  }

  return rows;
}

export async function callAiExtraction(
  systemPrompt: string,
  userPrompt: string,
  useGemini: boolean
): Promise<{ raw: string; provider: string; model: string }> {
  if (useGemini) {
    const raw = await geminiGenerateJson(systemPrompt, userPrompt);
    return { raw, provider: 'gemini', model: readGeminiModel() };
  }

  const raw = await openaiService.rawJsonObject(userPrompt, systemPrompt, 0.1);
  return { raw, provider: 'openai', model: env.openai.model };
}

export async function extractTenderParameterCandidates(
  pages: PageText[],
  opts?: {
    aliasHints?: string;
    serviceContext?: string;
    metadata?: TenderParameterExtractionMetadata;
    pageClassifications?: Array<{ page: number; sections: Array<{ section: string; confidence: number }> }>;
  }
) {
  if (!pages.length) return { candidates: [], aiUsed: false, chunksProcessed: 0 };

  const useGemini = isGeminiConfigured();
  const useOpenAi =
    !!getOpenAIClient() && env.openai.enabled && !!env.openai.apiKey && !isQuotaBlocked('openai');
  if (!useGemini && !useOpenAi) return { candidates: [], aiUsed: false, chunksProcessed: 0 };

  const systemPrompt = buildCandidateExtractionSystemPrompt();
  const pageChunks = splitCandidatePageChunks(pages);
  const allRows: RawTenderParameterCandidateRow[] = [];
  const seen = new Set<string>();
  let aiModel: string | undefined;
  let aiProvider: string | undefined;
  let chunksProcessed = 0;

  for (const pageChunk of pageChunks) {
    const ocrGroups = splitPagesByOcrCharLimit(pageChunk);

    for (const ocrPages of ocrGroups) {
      const startPage = ocrPages[0].pageNumber;
      const endPage = ocrPages[ocrPages.length - 1].pageNumber;
      const ocrPayload = buildCandidateChunkPayload(ocrPages, opts?.pageClassifications);
      if (!ocrPayload.trim()) continue;

      chunksProcessed += 1;

      const userPrompt = buildCandidateExtractionUserPrompt(startPage, endPage, ocrPayload, {
        aliasHints: opts?.aliasHints,
        serviceContext: opts?.serviceContext,
        metadata: opts?.metadata,
      });
      let raw = '';

      try {
        const result = await callAiExtraction(systemPrompt, userPrompt, useGemini);
        raw = result.raw;
        aiModel = aiModel || `${result.provider}:${result.model}`;
        aiProvider = aiProvider || result.provider;
      } catch (geminiErr) {
        if (useGemini && useOpenAi && isGeminiApiError(geminiErr) && !isQuotaBlocked('openai')) {
          try {
            const result = await callAiExtraction(systemPrompt, userPrompt, false);
            raw = result.raw;
            aiModel = `${result.provider}:${result.model}`;
            aiProvider = result.provider;
            console.warn('[CandidateExtraction] Gemini failed, used OpenAI fallback', { startPage, endPage });
          } catch (openaiErr) {
            if (isOpenAIApiError(openaiErr)) markQuotaExceeded('openai');
            console.warn('[CandidateExtraction] OpenAI fallback failed', { startPage, endPage, error: String(openaiErr) });
            continue;
          }
        } else {
          console.warn('[CandidateExtraction] Chunk failed', { startPage, endPage, error: String(geminiErr) });
          continue;
        }
      }

      for (const row of parseCandidateChunkResponse(raw, ocrPages, {
        tenderType: opts?.metadata?.tenderType,
      })) {
        const key = `${row.page}|${row.parameter.toLowerCase()}|${row.value.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allRows.push(row);
      }
    }
  }

  return {
    candidates: allRows.sort((a, b) => a.page - b.page || a.parameter.localeCompare(b.parameter)),
    aiUsed: allRows.length > 0 || !!(useGemini || useOpenAi),
    aiModel,
    aiProvider,
    chunksProcessed,
  };
}
