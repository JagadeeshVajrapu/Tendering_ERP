import { getOpenAIClient } from './openaiClient';
import { GEMINI_QUOTA_USER_MESSAGE, isGeminiConfigured } from './geminiClient';
import { OPENAI_QUOTA_USER_MESSAGE } from './openaiClient';

export type AiQuotaProvider = 'gemini' | 'openai';

const COOLDOWN_MS = 2 * 60 * 1000;
const blockedUntil = new Map<AiQuotaProvider, number>();

export function markQuotaExceeded(provider: AiQuotaProvider): void {
  blockedUntil.set(provider, Date.now() + COOLDOWN_MS);
  console.warn(`[AiQuotaGuard] ${provider} quota exceeded — skipping AI for ${COOLDOWN_MS / 60000} min`);
}

export function isQuotaBlocked(provider: AiQuotaProvider): boolean {
  const until = blockedUntil.get(provider);
  if (!until) return false;
  if (Date.now() >= until) {
    blockedUntil.delete(provider);
    return false;
  }
  return true;
}

export function clearQuotaBlock(provider: AiQuotaProvider): void {
  blockedUntil.delete(provider);
}

export function clearAllQuotaBlocks(): void {
  blockedUntil.clear();
}

export function isAiExtractionBlocked(): boolean {
  const gemini = isGeminiConfigured();
  const openai = !!getOpenAIClient();
  if (!gemini && !openai) return true;
  const geminiOk = gemini && !isQuotaBlocked('gemini');
  const openaiOk = openai && !isQuotaBlocked('openai');
  return !geminiOk && !openaiOk;
}

export function getAiQuotaWarning(): string | undefined {
  const parts: string[] = [];
  if (isGeminiConfigured() && isQuotaBlocked('gemini')) parts.push(GEMINI_QUOTA_USER_MESSAGE);
  if (getOpenAIClient() && isQuotaBlocked('openai')) parts.push(OPENAI_QUOTA_USER_MESSAGE);
  return parts.length ? parts.join(' ') : undefined;
}
