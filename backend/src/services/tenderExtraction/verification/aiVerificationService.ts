import { env } from '../../../config/env';
import { AppError } from '../../../middleware/errorHandler';
import { IExtractedField, IAiVerificationResult } from '../../../models/TenderExtraction';
import { gpt4oFieldVerificationService } from '../../ai/gpt4oFieldVerificationService';

interface VerifyParams {
  provider: 'openai' | 'gemini';
  extractedFields: IExtractedField[];
}

function jsonFromText(s: string): unknown {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found in AI response');
  return JSON.parse(s.slice(start, end + 1));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

function normalizeAiOutput(raw: unknown): {
  verifiedFields: IAiVerificationResult['verifiedFields'];
  missingFields: string[];
  corrections: IAiVerificationResult['corrections'];
} {
  const o = raw as Record<string, unknown>;
  const verified = Array.isArray(o.verifiedFields) ? (o.verifiedFields as unknown[]) : [];
  const verifiedFields = verified
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      fieldName: String(x.fieldName || ''),
      value: String(x.value || ''),
      ok: Boolean(x.ok),
      reason: typeof x.reason === 'string' ? x.reason : undefined,
    }))
    .filter((x) => x.fieldName && x.value);

  const correctionsArr = Array.isArray(o.corrections) ? (o.corrections as unknown[]) : [];
  const corrections = correctionsArr
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({
      fieldName: String(x.fieldName || ''),
      from: typeof x.from === 'string' ? x.from : undefined,
      to: String(x.to || ''),
      reason: typeof x.reason === 'string' ? x.reason : undefined,
    }))
    .filter((x) => x.fieldName && x.to);

  return {
    verifiedFields,
    missingFields: asStringArray(o.missingFields),
    corrections,
  };
}

async function callGemini(prompt: string): Promise<string> {
  if (!env.gemini.apiKey || !env.gemini.enabled) throw new AppError('Gemini is not configured.', 500);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new AppError(`Gemini API failed (${res.status})`, 502);
  const data = (await res.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AppError('Gemini returned empty response.', 502);
  return String(text);
}

class AiVerificationService {
  async verifyAndCorrect(params: VerifyParams): Promise<{ fields: IExtractedField[]; aiVerification: IAiVerificationResult }> {
    // Production refactor: verify per-field only using (fieldName, extractedValue, sourceText, sourcePage).
    // Never send full document.
    const byName = new Map(params.extractedFields.map((f) => [f.fieldName, { ...f }]));
    const verifiedFields: IAiVerificationResult['verifiedFields'] = [];
    const missingFields = new Set<string>();
    const corrections: IAiVerificationResult['corrections'] = [];

    for (const f of params.extractedFields) {
      if (params.provider !== 'openai') continue; // keep Gemini path unchanged for now
      if (!env.openai.apiKey || !env.openai.enabled) throw new AppError('OpenAI is not configured.', 500);

      const started = Date.now();
      const input = {
        fieldName: f.fieldName,
        extractedValue: f.value,
        sourceText: f.evidence || '',
        sourcePage: (f as { sourcePage?: number }).sourcePage ?? '',
      };

      const out = await gpt4oFieldVerificationService.verifyField(input);
      if (!out) continue;

      verifiedFields.push({
        fieldName: f.fieldName,
        value: out.verifiedValue || f.value,
        ok: out.correctness === 'correct' && out.confidence >= 70,
        reason: out.notes,
      });

      for (const m of out.missingFields || []) missingFields.add(m);

      // Apply conservative correction: only when confident and non-empty.
      if (out.correctness === 'correct' && out.confidence >= 85 && out.verifiedValue && out.verifiedValue !== f.value) {
        const existing = byName.get(f.fieldName);
        if (existing) {
          corrections.push({ fieldName: f.fieldName, from: existing.value, to: out.verifiedValue, reason: out.notes });
          existing.value = out.verifiedValue;
          existing.normalizedValue = out.verifiedValue;
          existing.confidence = Math.max(existing.confidence, Math.min(95, out.confidence));
          byName.set(f.fieldName, existing);
        }
      }

      console.log('[OpenAI] Processing Time', {
        fieldName: f.fieldName,
        processingTimeMs: Date.now() - started,
      });
    }

    const aiVerification: IAiVerificationResult = {
      provider: params.provider,
      verifiedAt: new Date(),
      verifiedFields,
      missingFields: Array.from(missingFields),
      corrections,
    };

    return { fields: Array.from(byName.values()), aiVerification };
  }
}

export const aiVerificationService = new AiVerificationService();

