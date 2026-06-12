import { MasterDatasetVerificationStatus } from '../../types/enterpriseAiVerificationMasterDataset';
import { geminiGenerateJson, isGeminiConfigured, isGeminiApiError } from '../ai/geminiClient';
import { openaiService } from '../ai/openaiService';
import { env } from '../../config/env';
import { getOpenAIClient, isOpenAIApiError } from '../ai/openaiClient';
import { isQuotaBlocked } from '../ai/aiQuotaGuard';

export interface MasterDatasetAiVerifyInput {
  parameter: string;
  value: string;
  pageNumber: number;
  sourceText: string;
  sourceSection?: string;
  tenderType?: string;
  validationStatus?: string;
}

export interface MasterDatasetAiVerifyResult {
  parameter: string;
  verificationStatus: MasterDatasetVerificationStatus;
  confidence: number;
  reason: string;
}

const VERIFICATION_QUESTIONS = [
  'Is this currency amount really the EMD / Earnest Money Deposit?',
  'Is this amount really the Tender Value / Estimated Cost?',
  'Is this date really a Bid End Date or submission deadline?',
  'Is this text really a Scope Of Work / service description?',
  'Does the parameter label correctly match the extracted value in context?',
];

const SYSTEM_PROMPT = `You are a Senior Government Tender Analyst performing FINAL verification before parameters enter the Master Dataset.

For EACH parameter-value pair, verify:
1. Parameter Name — is the label correct?
2. Parameter Value — does the value match what the label expects (amount/date/text)?
3. Context — does sourceText support this mapping?
4. Section — is the value from a relevant tender section (not TOC, annexure ref, heading)?
5. Tender-Type Relevance — is this appropriate for the detected tender type?

REJECT wrong mappings such as:
- Tender Value = turnover or experience text
- EMD Amount = "Security Deposit" label confusion or non-EMD amount
- Bid End Date = "Technical" or "Financial" (section names, not dates)
- Scope Of Work = section heading or single word
- Any label where value is a clause number, annexure reference, page number, or navigation text

Return JSON only:
{
  "verifications": [
    {
      "parameter": "",
      "status": "VERIFIED",
      "confidence": 96,
      "reason": ""
    }
  ]
}

status must be one of: VERIFIED, REVIEW, REJECT
confidence: 0-100`;

function buildUserPrompt(rows: MasterDatasetAiVerifyInput[]): string {
  const items = rows.map(
    (r, i) =>
      `${i + 1}. parameter="${r.parameter}" value="${r.value}" page=${r.pageNumber} section="${(r.sourceSection || '').slice(0, 60)}" tenderType="${r.tenderType || ''}" validation="${r.validationStatus || ''}" sourceText="${(r.sourceText || '').slice(0, 250)}"`
  );
  return `Verify each parameter-value pair. Block incorrect label-value mappings.

${VERIFICATION_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Pairs to verify:
${items.join('\n')}`;
}

function parseVerifications(
  raw: string,
  rows: MasterDatasetAiVerifyInput[]
): MasterDatasetAiVerifyResult[] {
  let parsed: { verifications?: unknown[] };
  try {
    parsed = JSON.parse(raw) as { verifications?: unknown[] };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return rows.map((r) => fallbackReview(r, 'AI parse failure'));
    parsed = JSON.parse(match[0]) as { verifications?: unknown[] };
  }

  if (!Array.isArray(parsed.verifications)) {
    return rows.map((r) => fallbackReview(r, 'AI returned no verifications'));
  }

  const byParam = new Map<string, MasterDatasetAiVerifyResult>();
  for (const item of parsed.verifications) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const parameter = String(row.parameter ?? '').trim();
    if (!parameter) continue;

    const statusRaw = String(row.status ?? 'REVIEW').toUpperCase();
    const status: MasterDatasetVerificationStatus =
      statusRaw === 'VERIFIED' || statusRaw === 'REJECT' ? statusRaw : 'REVIEW';

    byParam.set(parameter.toLowerCase(), {
      parameter,
      verificationStatus: status,
      confidence: Math.min(100, Math.max(0, Number(row.confidence) || (status === 'VERIFIED' ? 85 : 50))),
      reason: String(row.reason ?? ''),
    });
  }

  return rows.map((r) => {
    const hit = byParam.get(r.parameter.toLowerCase());
    if (hit) return hit;
    return fallbackReview(r, 'No AI verification match');
  });
}

function fallbackReview(row: MasterDatasetAiVerifyInput, reason: string): MasterDatasetAiVerifyResult {
  return {
    parameter: row.parameter,
    verificationStatus: 'REVIEW',
    confidence: 45,
    reason,
  };
}

export async function verifyMasterDatasetParametersWithAi(
  rows: MasterDatasetAiVerifyInput[]
): Promise<MasterDatasetAiVerifyResult[]> {
  if (!rows.length) return [];

  const useGemini = isGeminiConfigured();
  const useOpenAi =
    !!getOpenAIClient() && env.openai.enabled && !!env.openai.apiKey && !isQuotaBlocked('openai');

  if (!useGemini && !useOpenAi) {
    return rows.map((r) => fallbackReview(r, 'AI unavailable — rule-based review'));
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
        return rows.map((r) => fallbackReview(r, 'AI failed — rule-based review'));
      }
    } else {
      return rows.map((r) => fallbackReview(r, 'AI failed — rule-based review'));
    }
  }

  return parseVerifications(raw, rows);
}

export { VERIFICATION_QUESTIONS };
