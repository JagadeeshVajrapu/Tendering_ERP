import { DynamicParameterAiEvaluation } from '../../types/enterpriseDynamicParameterDiscovery';
import { geminiGenerateJson, isGeminiConfigured, isGeminiApiError } from '../ai/geminiClient';
import { openaiService } from '../ai/openaiService';
import { env } from '../../config/env';
import { getOpenAIClient, isOpenAIApiError } from '../ai/openaiClient';
import { isQuotaBlocked } from '../ai/aiQuotaGuard';
import {
  BUSINESS_RELEVANT_CATEGORIES,
  normalizeBusinessCategory,
} from './businessRelevantDynamicParameterEngine';

const GENUINE_REQUIREMENT_QUESTION =
  'Is this a genuine tender requirement, eligibility condition, compliance condition, financial condition, scope condition, manpower requirement, technical requirement, contract condition, or procurement requirement?';

const SYSTEM_PROMPT = `You are a Senior Government Tender Analyst evaluating extracted label→value pairs from tender documents (CPWD, GeM, Railways, PSU, Security, Manpower, Housekeeping, IT, Civil, Procurement, etc.).

For EACH parameter, answer this question:
"${GENUINE_REQUIREMENT_QUESTION}"

If YES → set genuine=true and assign ONE category from:
${BUSINESS_RELEVANT_CATEGORIES.join(', ')}

If NO → set genuine=false (table of contents, index entries, page numbers, headers, footers, annexure references, clause/section/chapter references, navigation text, contact blocks, email/phone blocks, repeated titles, document metadata, random OCR noise).

REJECT examples: "Contents", "Index", "Page 15", "Clause 5.2", "Section 7.3", "Annexure A", "Appendix B", "Contact Us", "Email Address", "Phone Number", "Chapter 3", "Refer Annexure A".

ACCEPT examples: Warranty Period, Response Time SLA, Fuel Requirement, Vehicle Requirement, OEM Authorization, PSARA License, Drone Surveillance Requirement, Deployment Strength, Operator Count, Guard Count, Machine Requirement.

Return JSON only:
{
  "evaluations": [
    {
      "parameter": "",
      "genuine": true,
      "category": "Compliance",
      "confidence": 85,
      "reason": ""
    }
  ]
}`;

export interface DynamicEvalInput {
  parameter: string;
  value: string;
  sourceText: string;
  page: number;
}

function buildUserPrompt(rows: DynamicEvalInput[]): string {
  const items = rows.map(
    (r, i) =>
      `${i + 1}. parameter="${r.parameter}" value="${r.value}" page=${r.page} sourceText="${r.sourceText.slice(0, 200)}"`
  );
  return `${GENUINE_REQUIREMENT_QUESTION}

Evaluate each extracted tender parameter below. Store only if genuine=true.

${items.join('\n')}`;
}

function parseEvaluations(raw: string, rows: DynamicEvalInput[]): DynamicParameterAiEvaluation[] {
  let parsed: { evaluations?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { evaluations?: unknown[] };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return rows.map((r) => rejectEvaluation(r, 'AI parse failure'));
    parsed = JSON.parse(match[0]) as { evaluations?: unknown[] };
  }

  if (!Array.isArray(parsed.evaluations)) {
    return rows.map((r) => rejectEvaluation(r, 'AI returned no evaluations'));
  }

  const byParam = new Map<string, DynamicParameterAiEvaluation>();
  for (const item of parsed.evaluations) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const parameter = String(row.parameter ?? '').trim();
    if (!parameter) continue;

    const genuine = row.genuine === true || String(row.genuine).toLowerCase() === 'true';
    const category = normalizeBusinessCategory(String(row.category ?? 'Tender Specific'));

    byParam.set(parameter.toLowerCase(), {
      parameter,
      genuine,
      category,
      confidence: Math.min(100, Math.max(0, Number(row.confidence) || (genuine ? 80 : 40))),
      reason: String(row.reason ?? (genuine ? 'AI confirmed genuine requirement' : 'AI rejected as non-requirement')),
    });
  }

  return rows.map((r) => {
    const hit = byParam.get(r.parameter.toLowerCase());
    if (hit) return hit;
    return rejectEvaluation(r, 'No AI evaluation match — rejected by default');
  });
}

function rejectEvaluation(row: DynamicEvalInput, reason: string): DynamicParameterAiEvaluation {
  return {
    parameter: row.parameter,
    genuine: false,
    category: 'Tender Specific',
    confidence: 0,
    reason,
  };
}

function ruleBasedFallback(rows: DynamicEvalInput[], reason: string): DynamicParameterAiEvaluation[] {
  return rows.map((r) => rejectEvaluation(r, reason));
}

export async function evaluateDynamicParametersWithAi(
  rows: DynamicEvalInput[]
): Promise<DynamicParameterAiEvaluation[]> {
  if (!rows.length) return [];

  const useGemini = isGeminiConfigured();
  const useOpenAi =
    !!getOpenAIClient() && env.openai.enabled && !!env.openai.apiKey && !isQuotaBlocked('openai');

  if (!useGemini && !useOpenAi) {
    return ruleBasedFallback(rows, 'AI unavailable — rejected (business-relevance requires AI gate)');
  }

  const userPrompt = buildUserPrompt(rows);
  let raw = '';

  try {
    if (useGemini) {
      raw = await geminiGenerateJson(SYSTEM_PROMPT, userPrompt);
    } else {
      raw = await openaiService.rawJsonObject(userPrompt, SYSTEM_PROMPT, 0.1);
    }
  } catch (primaryErr) {
    if (useGemini && useOpenAi && isGeminiApiError(primaryErr)) {
      try {
        raw = await openaiService.rawJsonObject(userPrompt, SYSTEM_PROMPT, 0.1);
      } catch {
        return ruleBasedFallback(rows, 'AI failed — rejected (business-relevance requires AI gate)');
      }
    } else {
      return ruleBasedFallback(rows, 'AI failed — rejected (business-relevance requires AI gate)');
    }
  }

  return parseEvaluations(raw, rows);
}

export { GENUINE_REQUIREMENT_QUESTION };
