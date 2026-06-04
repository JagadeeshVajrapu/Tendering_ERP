import { env } from '../../config/env';
import { getOpenAIClient, isOpenAIApiError } from '../ai/openaiClient';
import { ProductionFieldDefinition } from './fieldDefinitions';
import { VerifiedFieldCandidate } from './fieldContextVerifier';
import { gpt4oFieldVerificationService } from '../ai/gpt4oFieldVerificationService';
import { pipelineCacheService } from '../cache/pipelineCacheService';

export interface AiVerificationResult {
  selectedIndex: number | null;
  confidence: number;
  reason: string;
}

export interface SingleFieldAiVerification {
  accepted: boolean;
  confidence: number;
  reason: string;
}

/**
 * Targeted AI verification — never bulk NIT extraction.
 */
class FieldAiVerifier {
  /**
   * Verify whether a single extracted value truly belongs to the field.
   * Used when rule confidence is below 0.90.
   */
  async verifySingleFieldValue(
    def: ProductionFieldDefinition,
    value: string,
    context: string
  ): Promise<SingleFieldAiVerification | null> {
    try {
      const out = await gpt4oFieldVerificationService.verifyField({
        fieldName: def.label,
        extractedValue: value,
        sourceText: context,
        sourcePage: '',
      });
      if (!out) return null;

      const accepted = out.correctness === 'correct' && out.confidence >= 70 && out.verifiedValue.trim().length > 0;
      return {
        accepted,
        confidence: Math.min(0.99, Math.max(0, out.confidence / 100)),
        reason: out.notes || (accepted ? 'GPT-4o confirmed' : 'GPT-4o rejected/uncertain'),
      };
    } catch (err) {
      if (isOpenAIApiError(err) && env.openai.fallbackOnError) {
        return null;
      }
      console.warn(`[FieldAI] Single-field verification skipped for ${def.id}:`, err);
      return null;
    }
  }

  /** Tie-break when multiple candidates remain ambiguous. */
  async pickBestCandidate(
    def: ProductionFieldDefinition,
    candidates: VerifiedFieldCandidate[],
    maxCandidates = 4
  ): Promise<AiVerificationResult | null> {
    if (!env.openai.enabled || !getOpenAIClient()) return null;
    if (candidates.length < 2) return null;

    const top = candidates
      .filter((c) => c.accepted)
      .sort((a, b) => b.verificationScore - a.verificationScore)
      .slice(0, maxCandidates);

    if (top.length < 2) return null;

    const margin = top[0].verificationScore - top[1].verificationScore;
    if (margin > 0.12 && top[0].verificationScore >= 0.88) return null;

    const client = getOpenAIClient();
    if (!client) return null;

    const options = top
      .map(
        (c, i) =>
          `[${i}] value="${c.normalizedValue || c.value}" | context="${c.sourceText.slice(0, 280).replace(/"/g, "'")}"`
      )
      .join('\n');

    const pickCacheKey = pipelineCacheService.openAiPickKey(def.id, options);
    const cachedPick = await pipelineCacheService.getJson<AiVerificationResult>(pickCacheKey);
    if (cachedPick) {
      return cachedPick;
    }

    const prompt = `You are an Enterprise Tender Verification Engine.

Field: ${def.label} (id: ${def.id})

Candidates extracted from a tender document:
${options}

Rules:
- Choose ONLY the candidate whose surrounding context proves it is the actual ${def.label}.
- Reject candidates from wrong sections (e.g. bid validity days for contract duration).
- If NONE are correct, return {"index": null, "confidence": 0, "reason": "..."}
- Return strict JSON only: {"index": number|null, "confidence": 0.0-1.0, "reason": "brief"}`;

    try {
      const res = await client.chat.completions.create({
        model: env.openai.model,
        temperature: 0,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: 'Tender field verifier. JSON only. Never guess. Prefer null over wrong value.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = res.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as {
        index?: number | null;
        confidence?: number;
        reason?: string;
      };

      const idx = parsed.index;
      if (idx === null || idx === undefined) {
        return { selectedIndex: null, confidence: 0, reason: parsed.reason || 'AI rejected all' };
      }
      if (idx < 0 || idx >= top.length) return null;

      const result: AiVerificationResult = {
        selectedIndex: idx,
        confidence: Math.min(0.99, Math.max(0, parsed.confidence ?? 0.85)),
        reason: parsed.reason || 'AI selected best contextual match',
      };
      await pipelineCacheService.setJson(pickCacheKey, result, env.cache.openaiTtlSec);
      return result;
    } catch (err) {
      if (isOpenAIApiError(err) && env.openai.fallbackOnError) {
        return null;
      }
      console.warn(`[FieldAI] Verification skipped for ${def.id}:`, err);
      return null;
    }
  }
}

export const fieldAiVerifier = new FieldAiVerifier();
