import { env } from '../../config/env';
import { pipelineCacheService } from '../cache/pipelineCacheService';
import { getOpenAIClient, isOpenAIApiError } from './openaiClient';

export interface FieldVerificationInput {
  fieldName: string;
  extractedValue: string;
  sourceText: string;
  sourcePage: string | number;
}

export interface FieldVerificationOutput {
  fieldName: string;
  verifiedValue: string;
  confidence: number; // 0-100
  // Additional diagnostics for internal use / logs.
  missingFields?: string[];
  alternatives?: string[];
  correctness?: 'correct' | 'incorrect' | 'uncertain';
  notes?: string;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Invalid JSON from OpenAI');
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeOutput(input: FieldVerificationInput, raw: unknown): FieldVerificationOutput {
  const o = raw as Record<string, unknown>;
  const fieldName = String(o.fieldName || input.fieldName || '').trim();
  const verifiedValue = String(o.verifiedValue ?? input.extractedValue ?? '').trim();
  const confidenceNum = Number(o.confidence);
  const confidence = Number.isFinite(confidenceNum) ? clamp(Math.round(confidenceNum), 0, 100) : 0;

  return {
    fieldName: fieldName || input.fieldName,
    verifiedValue,
    confidence,
    correctness:
      o.correctness === 'correct' || o.correctness === 'incorrect' || o.correctness === 'uncertain'
        ? (o.correctness as any)
        : undefined,
    missingFields: asStringArray(o.missingFields),
    alternatives: asStringArray(o.alternatives),
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 300) : undefined,
  };
}

export class Gpt4oFieldVerificationService {
  /**
   * Verify ONE extracted field using ONLY the provided evidence.
   * Never send full document text.
   */
  async verifyField(input: FieldVerificationInput): Promise<FieldVerificationOutput | null> {
    if (!env.openai.enabled || !env.openai.apiKey) return null;
    const client = getOpenAIClient();
    if (!client) return null;

    const started = Date.now();

    const cacheKey = pipelineCacheService.openAiFieldKey(
      input.fieldName,
      input.extractedValue,
      input.sourceText,
      String(input.sourcePage ?? '')
    );
    const cached = await pipelineCacheService.getOpenAiFieldVerify(cacheKey);
    if (cached) {
      console.log('[OpenAI] Processing Time', {
        fieldName: cached.fieldName,
        processingTimeMs: Date.now() - started,
        cacheHit: true,
      });
      return cached;
    }

    const requestPayload = {
      fieldName: input.fieldName,
      extractedValue: input.extractedValue,
      sourcePage: String(input.sourcePage ?? ''),
      sourceText: String(input.sourceText ?? '').slice(0, 900),
    };

    console.log('[OpenAI] Request', {
      model: 'gpt-4o',
      ...requestPayload,
    });

    const prompt = [
      'You are verifying ONE rule-extracted field from an Indian government tender/NIT.',
      'Use ONLY the provided sourceText and fieldName. Do NOT assume information outside sourceText.',
      '',
      'Input JSON:',
      JSON.stringify(requestPayload),
      '',
      'Tasks:',
      '1. Verify whether extractedValue matches the evidence in sourceText for fieldName.',
      '2. Correct verifiedValue if extractedValue is wrong but sourceText contains the right value.',
      '3. If extractedValue is empty but sourceText contains the field, fill verifiedValue from sourceText.',
      '4. List missingFields — other important tender fields referenced near this evidence but not provided.',
      '',
      'Rules:',
      '- If incorrect: verifiedValue="" , confidence 0-40, correctness="incorrect".',
      '- If uncertain: confidence 40-69, correctness="uncertain".',
      '- If correct or corrected: confidence 70-100, correctness="correct".',
      '',
      'Return ONLY JSON:',
      '{"fieldName":"string","verifiedValue":"string","confidence":0-100,"correctness":"correct"|"incorrect"|"uncertain","missingFields":["string"],"alternatives":["string"],"notes":"string"}',
    ].join('\n');

    try {
      const res = await client.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: 'Field verification engine. Prefer empty over wrong. JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const rawText = res.choices[0]?.message?.content || '{}';
      const raw = safeJsonParse(rawText);
      const out = normalizeOutput(input, raw);

      console.log('[OpenAI] Response', {
        fieldName: out.fieldName,
        verifiedValue: out.verifiedValue,
        confidence: out.confidence,
        correctness: out.correctness,
        missingFields: out.missingFields,
        processingTimeMs: Date.now() - started,
      });

      await pipelineCacheService.setOpenAiFieldVerify(cacheKey, out);
      return out;
    } catch (err) {
      console.warn('[OpenAI] Error', {
        fieldName: input.fieldName,
        processingTimeMs: Date.now() - started,
        message: err instanceof Error ? err.message : String(err),
      });
      if (isOpenAIApiError(err) && env.openai.fallbackOnError) return null;
      return null;
    }
  }
}

export const gpt4oFieldVerificationService = new Gpt4oFieldVerificationService();

