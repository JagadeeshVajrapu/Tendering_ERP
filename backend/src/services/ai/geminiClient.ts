import path from 'path';
import dotenv from 'dotenv';
import { env } from '../../config/env';
import { markQuotaExceeded } from './aiQuotaGuard';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
let lastSeenGeminiKey = '';

function refreshEnvInDev(): void {
  if (!env.isDevelopment) return;
  dotenv.config({ path: ENV_PATH, override: true });
}

function clearGeminiQuotaBlockIfKeyChanged(key: string): void {
  if (!key || key === lastSeenGeminiKey) return;
  if (lastSeenGeminiKey) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clearQuotaBlock } = require('./aiQuotaGuard') as typeof import('./aiQuotaGuard');
    clearQuotaBlock('gemini');
  }
  lastSeenGeminiKey = key;
}

export function readGeminiApiKey(): string {
  refreshEnvInDev();
  const key = (process.env.GEMINI_API_KEY || env.gemini.apiKey || '').trim();
  clearGeminiQuotaBlockIfKeyChanged(key);
  return key;
}

export function readGeminiModel(): string {
  refreshEnvInDev();
  return (process.env.GEMINI_MODEL || env.gemini.model || 'gemini-2.5-flash').trim();
}

export function isGeminiEnabled(): boolean {
  refreshEnvInDev();
  return process.env.GEMINI_ENABLED !== 'false' && env.gemini.enabled !== false;
}

export function isGeminiConfigured(): boolean {
  return isGeminiEnabled() && !!readGeminiApiKey();
}

export function isGeminiApiError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  return (
    (e.status !== undefined && e.status >= 400) ||
    /gemini|quota|rate limit|api key|401|403|429/i.test(String(e.message || ''))
  );
}

export function isGeminiQuotaError(err: unknown): boolean {
  if (!isGeminiApiError(err)) return false;
  const e = err as { status?: number; message?: string };
  return e.status === 429 || /quota|billing|exceeded your current quota|rate.?limit/i.test(String(e.message || ''));
}

export const GEMINI_QUOTA_USER_MESSAGE =
  'Gemini quota exceeded. Check billing or update GEMINI_API_KEY in backend/.env.';

const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

async function geminiGenerateJsonWithModel(model: string, apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Gemini API failed (${res.status}): ${body.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return String(text);
}

export async function geminiGenerateJson(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = readGeminiApiKey();
  if (!apiKey || !isGeminiEnabled()) {
    throw new Error('Gemini is not configured. Set GEMINI_API_KEY and GEMINI_ENABLED=true in backend/.env');
  }

  const prompt = `${systemPrompt}\n\n${userPrompt}`.slice(0, 120000);
  const preferred = readGeminiModel();
  const models = [preferred, ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== preferred)];

  let lastError: unknown;
  let allQuotaErrors = true;

  for (const model of models) {
    try {
      const text = await geminiGenerateJsonWithModel(model, apiKey, prompt);
      if (model !== preferred) console.warn('[Gemini] Used fallback model', { preferred, used: model });
      return text;
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (status === 429 || isGeminiQuotaError(err)) {
        console.warn('[Gemini] Model quota/rate limited, trying next', { model, status });
        continue;
      }
      allQuotaErrors = false;
      if (status === 404 || status === 400) continue;
      break;
    }
  }

  if (allQuotaErrors && lastError && isGeminiQuotaError(lastError)) {
    markQuotaExceeded('gemini');
    const quotaErr = lastError instanceof Error ? lastError : new Error('Gemini quota exceeded');
    (quotaErr as Error & { status?: number }).status = 429;
    throw quotaErr;
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}
