import { env } from '../../config/env';
import { getOpenAIClient, isOpenAIApiError } from '../ai/openaiClient';
import {
  ChunkExtractionResult,
  DocumentChunkData,
  ExtractedField,
  ExtractionPass,
  IntelligenceFieldKey,
} from '../../types/intelligence';
import {
  AI_EXTRACTION_PASSES,
  buildFieldSchema,
  MAX_RETRIES,
  PASS_FIELDS,
  RETRY_DELAY_MS,
} from './fields';
import { filterValidExtractions } from './valueValidator';
import { localIntelligenceExtractor } from './localIntelligenceExtractor';

let openAiCircuitOpen = false;

export function isOpenAiCircuitOpen(): boolean {
  return openAiCircuitOpen;
}

export function resetOpenAiCircuit(): void {
  openAiCircuitOpen = false;
}

function markOpenAiUnavailable(err: unknown): void {
  if (isOpenAIApiError(err)) {
    openAiCircuitOpen = true;
    console.warn('[ChunkAI] OpenAI unavailable — using local extraction for remaining chunks');
  }
}

const STRICT_RULES = `
STRICT EXTRACTION RULES (MANDATORY):
- Extract ONLY information explicitly written in the chunk text.
- NEVER invent, infer, guess, or hallucinate any value.
- If a field is not found, return an empty array [] for that field.
- Each value must be a concise phrase — NOT a paragraph or legal clause.
- tenderName: title/name of the tender only (max 300 chars). Never legal boilerplate.
- emdAmount: numeric amount with currency only (e.g. "₹50,000" or "Rs. 1,00,000"). Never sentences.
- Dates: date/time only (e.g. "15/03/2025 17:00").
- List fields: each item is one distinct requirement/document/condition (max 400 chars each).
- confidence: 0.9+ only if exact match found; 0.7-0.89 if clear but partial; below 0.65 will be rejected.
- page: exact page number from --- PAGE N --- markers.
- Return STRICT JSON only. No markdown, no prose.`;

const PASS_INSTRUCTIONS: Partial<Record<ExtractionPass, string>> = {
  general:
    'PASS 1 — GENERAL: Extract tender identification only: name, authority, department, organization, reference numbers, type, category, contract duration, location, service category, contact, submission mode. Do NOT extract scope or financials in this pass.',
  scope:
    'PASS 1 — SCOPE: Extract scope of work / nature of work / description of work only. One concise scope statement per value (max 400 chars).',
  eligibility:
    'PASS 2 — ELIGIBILITY: Extract ALL eligibility, qualification, experience, turnover, manpower, license, certification, statutory, and technical requirements. One criterion per list item.',
  financial:
    'PASS 3 — FINANCIAL: Extract ALL financial data: tender value, EMD, exemptions, bid security, tender fee, payment terms, performance security, bank guarantee, penalties, liquidated damages, financial conditions.',
  documents:
    'PASS 4 — DOCUMENTS: Extract EVERY document required for bid submission. One document name per list item.',
  dates:
    'PASS 5 — DATES: Extract ALL dates: publish, pre-bid meeting, submission start/end, technical/financial bid opening. Date values only.',
  compliance:
    'PASS 5 — COMPLIANCE: Extract ALL compliance requirements, statutory requirements, and registration requirements. One item per list entry.',
  risks:
    'PASS 4 — RISK: Extract ALL risk factors, penalty clauses, liquidated damages, and disqualification conditions. One item per list entry.',
};

class ChunkAiService {
  private async sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private buildPrompt(pass: ExtractionPass, chunk: DocumentChunkData): string {
    const fields = PASS_FIELDS[pass];
    const instruction = PASS_INSTRUCTIONS[pass] || `Extract fields for pass ${pass}.`;
    return `You are a Senior Tender Document Analyst for Indian government and enterprise tenders.

${instruction}

CHUNK ${chunk.chunkNumber} (Pages ${chunk.startPage}-${chunk.endPage})

${STRICT_RULES}

JSON schema:
${buildFieldSchema(fields)}`;
  }

  private parseChunkResponse(
    raw: string,
    pass: ExtractionPass,
    chunk: DocumentChunkData
  ): Partial<Record<IntelligenceFieldKey, ExtractedField[]>> {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return {};
      parsed = JSON.parse(match[0]);
    }

    const fields = PASS_FIELDS[pass];
    const result: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};

    for (const field of fields) {
      const rawField = parsed[field];
      if (!Array.isArray(rawField)) continue;

      const normalized: ExtractedField[] = [];
      for (const item of rawField) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const value = rec.value;
        if (value === null || value === undefined || value === '') continue;

        let page = Number(rec.page) || chunk.startPage;
        page = Math.max(chunk.startPage, Math.min(chunk.endPage, page));
        const confidence = Math.min(1, Math.max(0, Number(rec.confidence) || 0.5));

        normalized.push({
          value: Array.isArray(value) ? value.map(String) : String(value),
          page,
          confidence,
        });
      }

      const valid = filterValidExtractions(field, normalized);
      if (valid.length) result[field] = valid;
    }

    return result;
  }

  private localFallback(chunk: DocumentChunkData, pass: ExtractionPass): ChunkExtractionResult {
    const local = localIntelligenceExtractor.extractFromChunkText(
      chunk.text,
      chunk.startPage,
      chunk.endPage,
      chunk.chunkNumber
    );
    const passFields = PASS_FIELDS[pass];
    const filtered: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};
    for (const f of passFields) {
      if (local.fields[f]?.length) filtered[f] = local.fields[f];
    }
    return {
      chunkNumber: chunk.chunkNumber,
      pass,
      fields: filtered,
      rawJson: JSON.stringify(filtered),
      model: 'local-regex',
    };
  }

  async analyzeChunkPass(
    chunk: DocumentChunkData,
    pass: ExtractionPass
  ): Promise<ChunkExtractionResult> {
    const client = getOpenAIClient();
    if (!client || openAiCircuitOpen || !env.openai.enabled) {
      return this.localFallback(chunk, pass);
    }

    const systemPrompt = this.buildPrompt(pass, chunk);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: env.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: chunk.text.slice(0, 28000) },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        });

        const rawJson = response.choices[0]?.message?.content || '{}';
        const fields = this.parseChunkResponse(rawJson, pass, chunk);

        return {
          chunkNumber: chunk.chunkNumber,
          pass,
          fields,
          rawJson,
          model: env.openai.model,
          tokensUsed: response.usage?.total_tokens,
        };
      } catch (err) {
        lastError = err;
        if (isOpenAIApiError(err)) {
          if (env.openai.fallbackOnError) {
            markOpenAiUnavailable(err);
            return this.localFallback(chunk, pass);
          }
          if (attempt < MAX_RETRIES) {
            await this.sleep(RETRY_DELAY_MS * attempt);
            continue;
          }
        }
        if (env.openai.fallbackOnError) {
          markOpenAiUnavailable(err);
          return this.localFallback(chunk, pass);
        }
        throw err;
      }
    }

    if (env.openai.fallbackOnError) {
      return this.localFallback(chunk, pass);
    }
    throw lastError;
  }

  async analyzeChunkAllPasses(chunk: DocumentChunkData): Promise<ChunkExtractionResult[]> {
    const results: ChunkExtractionResult[] = [];

    if (openAiCircuitOpen || !getOpenAIClient()) {
      const local = localIntelligenceExtractor.extractFromChunkText(
        chunk.text,
        chunk.startPage,
        chunk.endPage,
        chunk.chunkNumber
      );
      for (const pass of AI_EXTRACTION_PASSES) {
        const passFields = PASS_FIELDS[pass];
        const filtered: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};
        for (const f of passFields) {
          if (local.fields[f]?.length) filtered[f] = local.fields[f];
        }
        results.push({
          chunkNumber: chunk.chunkNumber,
          pass,
          fields: filtered,
          rawJson: JSON.stringify(filtered),
          model: 'local-regex',
        });
      }
      return results;
    }

    for (const pass of AI_EXTRACTION_PASSES) {
      results.push(await this.analyzeChunkPass(chunk, pass));
    }

    return results;
  }

  async requeryPages(
    pages: { pageNumber: number; text: string }[],
    fields: IntelligenceFieldKey[],
    pass: ExtractionPass
  ): Promise<Partial<Record<IntelligenceFieldKey, ExtractedField[]>>> {
    if (openAiCircuitOpen || !getOpenAIClient()) {
      const pageTexts: import('../../types/intelligence').PageText[] = pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
        method: 'native' as const,
        charCount: p.text.length,
      }));
      const merged = localIntelligenceExtractor.extractFromPages(pageTexts);
      const allFields = merged[0]?.fields || {};
      const result: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};
      for (const f of fields) {
        if (allFields[f]?.length) result[f] = allFields[f];
      }
      return result;
    }

    const text = pages.map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    const startPage = pages[0].pageNumber;
    const endPage = pages[pages.length - 1].pageNumber;

    const chunk: DocumentChunkData = {
      chunkNumber: 0,
      startPage,
      endPage,
      text,
      pageNumbers: pages.map((p) => p.pageNumber),
    };

    const systemPrompt = `RE-QUERY: These fields were missing or rejected. Search these pages thoroughly.
${PASS_INSTRUCTIONS[pass] || `Extract pass: ${pass}`}

${STRICT_RULES}

Return STRICT JSON:
${buildFieldSchema(fields)}`;

    try {
      const client = getOpenAIClient();
      if (!client) return {};

      const response = await client.chat.completions.create({
        model: env.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.slice(0, 28000) },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const rawJson = response.choices[0]?.message?.content || '{}';
      return this.parseChunkResponse(rawJson, pass, chunk);
    } catch (err) {
      if (env.openai.fallbackOnError) {
        markOpenAiUnavailable(err);
        const pageTexts: import('../../types/intelligence').PageText[] = pages.map((p) => ({
          pageNumber: p.pageNumber,
          text: p.text,
          method: 'native' as const,
          charCount: p.text.length,
        }));
        const merged = localIntelligenceExtractor.extractFromPages(pageTexts);
        const allFields = merged[0]?.fields || {};
        const result: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};
        for (const f of fields) {
          if (allFields[f]?.length) result[f] = allFields[f];
        }
        return result;
      }
      return {};
    }
  }
}

export const chunkAiService = new ChunkAiService();
