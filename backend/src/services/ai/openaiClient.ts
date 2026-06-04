import OpenAI from 'openai';
import { env } from '../../config/env';

let cachedClient: OpenAI | null = null;
let cachedKey = '';

export function getOpenAIClient(): OpenAI | null {
  const apiKey = env.openai.apiKey?.trim();
  if (!apiKey || env.openai.enabled === false) return null;

  if (cachedClient && cachedKey === apiKey) return cachedClient;

  cachedKey = apiKey;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export function resetOpenAIClient(): void {
  cachedClient = null;
  cachedKey = '';
}

export function isOpenAIApiError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: string; message?: string; error?: { code?: string } };
  const code = e.code || e.error?.code || '';
  return (
    e.status === 429 ||
    e.status === 401 ||
    e.status === 403 ||
    e.status === 500 ||
    e.status === 503 ||
    code === 'insufficient_quota' ||
    code === 'rate_limit_exceeded' ||
    /quota|billing|rate limit|429|401|403|insufficient_quota/i.test(String(e.message))
  );
}

export function getOpenAIErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
