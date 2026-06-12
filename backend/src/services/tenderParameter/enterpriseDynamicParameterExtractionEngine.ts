import { PageText } from '../../types/intelligence';
import { TenderDocumentSection } from '../../types/tenderIntelligenceLayer';
import {
  EnterpriseDynamicParameterRow,
  EnterpriseDynamicSectionExtractionResult,
} from '../../types/enterpriseDynamicParameterExtraction';
import { RawTenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { isGeminiConfigured, isGeminiApiError, readGeminiModel } from '../ai/geminiClient';
import { getOpenAIClient, isOpenAIApiError } from '../ai/openaiClient';
import { isQuotaBlocked, markQuotaExceeded } from '../ai/aiQuotaGuard';
import { env } from '../../config/env';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import {
  callAiExtraction,
  CANDIDATE_EXTRACTION_CHUNK_SIZE,
  MIN_EXTRACTION_CONFIDENCE,
  parseCandidateChunkResponse,
  splitCandidatePageChunks,
  splitPagesByOcrCharLimit,
} from './tenderParameterCandidateExtractionEngine';
import {
  buildEnterpriseDynamicExtractionSystemPrompt,
  buildEnterpriseDynamicExtractionUserPrompt,
} from './enterpriseDynamicParameterExtractionPrompt';

function pagesForSection(allPages: PageText[], section: TenderDocumentSection): PageText[] {
  if (section.pages?.length) {
    const allowed = new Set(section.pages);
    return allPages.filter((p) => allowed.has(p.pageNumber));
  }
  if (section.startPage != null && section.endPage != null) {
    return allPages.filter(
      (p) => p.pageNumber >= section.startPage! && p.pageNumber <= section.endPage!
    );
  }
  return [];
}

function toEnterpriseRow(
  row: RawTenderParameterCandidateRow,
  sectionName: string
): EnterpriseDynamicParameterRow {
  return {
    parameter: row.parameter,
    value: row.value,
    page: row.page,
    sourceText: row.sourceText,
    confidence: row.confidence,
    category: row.category || sectionName,
    sectionName,
    isCoreParameter: row.isCoreParameter ?? isAllowedMasterParameter(row.parameter),
  };
}

function dedupeRows(rows: EnterpriseDynamicParameterRow[]): EnterpriseDynamicParameterRow[] {
  const seen = new Set<string>();
  const out: EnterpriseDynamicParameterRow[] = [];
  for (const row of rows) {
    const key = `${row.page}|${row.parameter.toLowerCase()}|${row.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function runSectionChunkExtraction(
  chunkPages: PageText[],
  tenderType: string,
  sectionName: string,
  opts?: { aliasHints?: string; extraContext?: string }
): Promise<{ rows: EnterpriseDynamicParameterRow[]; aiModel?: string }> {
  const useGemini = isGeminiConfigured();
  const useOpenAi =
    !!getOpenAIClient() && env.openai.enabled && !!env.openai.apiKey && !isQuotaBlocked('openai');
  if (!useGemini && !useOpenAi) return { rows: [] };

  const ocrGroups = splitPagesByOcrCharLimit(chunkPages);
  const allParsed: EnterpriseDynamicParameterRow[] = [];
  let aiModel: string | undefined;

  for (const ocrPages of ocrGroups) {
    const startPage = ocrPages[0]?.pageNumber ?? 1;
    const endPage = ocrPages[ocrPages.length - 1]?.pageNumber ?? startPage;
    const ocrPayload = ocrPages
      .map((p) => `[PAGE ${p.pageNumber}]\n${(p.text || '').trim()}\n`)
      .join('\n');
    if (!ocrPayload.trim()) continue;

    const systemPrompt = buildEnterpriseDynamicExtractionSystemPrompt();
    const userPrompt = buildEnterpriseDynamicExtractionUserPrompt({
      tenderType,
      sectionName,
      startPage,
      endPage,
      ocrPayload,
      aliasHints: opts?.aliasHints,
      extraContext: opts?.extraContext,
    });

    let raw = '';

    try {
      const result = await callAiExtraction(systemPrompt, userPrompt, useGemini);
      raw = result.raw;
      aiModel = aiModel || `${result.provider}:${result.model}`;
    } catch (geminiErr) {
      if (useGemini && useOpenAi && isGeminiApiError(geminiErr) && !isQuotaBlocked('openai')) {
        try {
          const result = await callAiExtraction(systemPrompt, userPrompt, false);
          raw = result.raw;
          aiModel = aiModel || `${result.provider}:${result.model}`;
        } catch (openaiErr) {
          if (isOpenAIApiError(openaiErr)) markQuotaExceeded('openai');
          continue;
        }
      } else {
        continue;
      }
    }

    const parsed = parseCandidateChunkResponse(raw, ocrPages)
      .filter((row) => row.confidence >= MIN_EXTRACTION_CONFIDENCE)
      .map((row) => toEnterpriseRow(row, sectionName));
    allParsed.push(...parsed);
  }

  return { rows: dedupeRows(allParsed), aiModel };
}

/**
 * Extract parameters for a single section using OCR text + tender type + section name.
 */
export async function extractParametersForSection(
  sectionPages: PageText[],
  tenderType: string,
  sectionName: string,
  opts?: { aliasHints?: string; extraContext?: string }
): Promise<EnterpriseDynamicSectionExtractionResult> {
  if (!sectionPages.length) {
    return {
      sectionName,
      tenderType,
      pages: [],
      parameters: [],
      chunksProcessed: 0,
    };
  }

  const chunks = splitCandidatePageChunks(sectionPages);
  const allRows: EnterpriseDynamicParameterRow[] = [];
  let chunksProcessed = 0;

  for (const chunk of chunks) {
    const result = await runSectionChunkExtraction(chunk, tenderType, sectionName, opts);
    chunksProcessed += 1;
    allRows.push(...result.rows);
  }

  return {
    sectionName,
    tenderType,
    pages: sectionPages.map((p) => p.pageNumber),
    parameters: dedupeRows(allRows),
    chunksProcessed,
  };
}

/**
 * Direct API input: OCR text + tender type + section name (single block).
 */
export async function extractFromOcrInput(input: {
  ocrText: string;
  tenderType: string;
  sectionName: string;
  pages: number[];
}): Promise<EnterpriseDynamicParameterRow[]> {
  const pageNumbers = input.pages.length ? input.pages : [1];
  const sectionPages: PageText[] = pageNumbers.map((pageNumber) => ({
    pageNumber,
    text: input.ocrText,
    method: 'ocr' as const,
    charCount: input.ocrText.length,
  }));

  const result = await extractParametersForSection(
    sectionPages,
    input.tenderType,
    input.sectionName
  );
  return result.parameters;
}

function buildFallbackSections(pages: PageText[]): TenderDocumentSection[] {
  const chunks = splitCandidatePageChunks(pages);
  return chunks.map((chunk, index) => ({
    section: index === 0 ? 'Identity' : 'Tender Specific',
    confidence: 50,
    pages: chunk.map((p) => p.pageNumber),
    startPage: chunk[0].pageNumber,
    endPage: chunk[chunk.length - 1].pageNumber,
    matchedKeywords: [],
  }));
}

/**
 * Enterprise Dynamic Parameter Extraction — section-aware full document pass.
 */
export async function extractEnterpriseDynamicParameters(
  pages: PageText[],
  opts?: {
    tenderType?: string;
    sections?: TenderDocumentSection[];
    aliasHints?: string;
    extraContext?: string;
    onChunkProgress?: (completed: number, total: number) => void | Promise<void>;
  }
): Promise<{
  parameters: EnterpriseDynamicParameterRow[];
  sectionResults: EnterpriseDynamicSectionExtractionResult[];
  aiUsed: boolean;
  aiModel?: string;
  chunksProcessed: number;
}> {
  if (!pages.length) {
    return { parameters: [], sectionResults: [], aiUsed: false, chunksProcessed: 0 };
  }

  const tenderType = opts?.tenderType || 'Unclassified';
  const sections =
    opts?.sections?.length && opts.sections.some((s) => (s.pages?.length || 0) > 0)
      ? opts.sections
      : buildFallbackSections(pages);

  const sectionResults: EnterpriseDynamicSectionExtractionResult[] = [];
  const allRows: EnterpriseDynamicParameterRow[] = [];
  let chunksProcessed = 0;
  let aiModel: string | undefined;

  const sectionChunkPlans = sections
    .map((section) => ({
      section,
      sectionPages: pagesForSection(pages, section),
    }))
    .filter((plan) => plan.sectionPages.length > 0)
    .map((plan) => ({
      ...plan,
      sectionChunks: splitCandidatePageChunks(plan.sectionPages),
    }));

  const coveredPages = new Set<number>();
  for (const plan of sectionChunkPlans) {
    for (const p of plan.sectionPages) coveredPages.add(p.pageNumber);
  }
  const uncoveredPages = pages.filter((p) => !coveredPages.has(p.pageNumber));
  if (uncoveredPages.length) {
    sectionChunkPlans.push({
      section: {
        section: 'Tender Specific',
        confidence: 55,
        pages: uncoveredPages.map((p) => p.pageNumber),
        startPage: uncoveredPages[0].pageNumber,
        endPage: uncoveredPages[uncoveredPages.length - 1].pageNumber,
        matchedKeywords: [],
      },
      sectionPages: uncoveredPages,
      sectionChunks: splitCandidatePageChunks(uncoveredPages),
    });
  }

  const totalChunks = sectionChunkPlans.reduce((sum, plan) => sum + plan.sectionChunks.length, 0);
  let completedChunks = 0;

  for (const plan of sectionChunkPlans) {
    const { section, sectionPages, sectionChunks } = plan;
    const sectionRows: EnterpriseDynamicParameterRow[] = [];

    for (const chunk of sectionChunks) {
      const chunkResult = await runSectionChunkExtraction(
        chunk,
        tenderType,
        section.section,
        { aliasHints: opts?.aliasHints, extraContext: opts?.extraContext }
      );
      aiModel = aiModel || chunkResult.aiModel;
      sectionRows.push(...chunkResult.rows);
      chunksProcessed += 1;
      completedChunks += 1;
      await opts?.onChunkProgress?.(completedChunks, totalChunks);
    }

    const sectionParameters = dedupeRows(sectionRows);
    allRows.push(...sectionParameters);

    sectionResults.push({
      sectionName: section.section,
      tenderType,
      pages: sectionPages.map((p) => p.pageNumber),
      parameters: sectionParameters,
      chunksProcessed: sectionChunks.length,
    });
  }

  const parameters = dedupeRows(allRows).sort(
    (a, b) => a.page - b.page || a.parameter.localeCompare(b.parameter)
  );

  const useGemini = isGeminiConfigured();
  const useOpenAi =
    !!getOpenAIClient() && env.openai.enabled && !!env.openai.apiKey && !isQuotaBlocked('openai');

  return {
    parameters,
    sectionResults,
    aiUsed: parameters.length > 0 || useGemini || useOpenAi,
    aiModel: aiModel || (useGemini ? `gemini:${readGeminiModel()}` : undefined),
    chunksProcessed,
  };
}

export function toRawCandidateRows(
  parameters: EnterpriseDynamicParameterRow[]
): RawTenderParameterCandidateRow[] {
  return parameters.map((row) => ({
    parameter: row.parameter,
    value: row.value,
    page: row.page,
    confidence: row.confidence,
    sourceText: row.sourceText,
    category: row.category,
    isCoreParameter: row.isCoreParameter,
  }));
}
