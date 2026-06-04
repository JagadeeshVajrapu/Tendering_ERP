import crypto from 'crypto';
import { env } from '../../config/env';
import { getRedisClient, isRedisAvailable } from '../../config/redis';
import { PageText } from '../../types/intelligence';
import { FieldVerificationOutput } from '../ai/gpt4oFieldVerificationService';

const MEMORY_MAX = 500;

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();

function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function pruneMemory(): void {
  if (memory.size <= MEMORY_MAX) return;
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) memory.delete(k);
  }
  if (memory.size <= MEMORY_MAX) return;
  const drop = memory.size - MEMORY_MAX;
  let i = 0;
  for (const k of memory.keys()) {
    memory.delete(k);
    if (++i >= drop) break;
  }
}

async function redisGet(key: string): Promise<string | null> {
  if (!env.cache.enabled || !isRedisAvailable()) return null;
  try {
    return await getRedisClient().get(key);
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: string, ttlSec: number): Promise<void> {
  if (!env.cache.enabled || !isRedisAvailable()) return;
  try {
    await getRedisClient().set(key, value, 'EX', ttlSec);
  } catch {
    // non-fatal
  }
}

function memoryGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

function memorySet(key: string, value: string, ttlSec: number): void {
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  pruneMemory();
}

class PipelineCacheService {
  ocrKey(contentHash: string): string {
    return `pipeline:ocr:v1:${contentHash}`;
  }

  openAiFieldKey(fieldName: string, extractedValue: string, sourceText: string, sourcePage: string): string {
    const payload = JSON.stringify({
      fieldName,
      extractedValue: extractedValue.slice(0, 400),
      sourceText: sourceText.slice(0, 900),
      sourcePage,
      model: 'gpt-4o',
    });
    return `pipeline:openai:field:v1:${sha256(payload)}`;
  }

  openAiPickKey(fieldId: string, candidatesFingerprint: string): string {
    return `pipeline:openai:pick:v1:${fieldId}:${sha256(candidatesFingerprint)}`;
  }

  hashBuffer(buffer: Buffer): string {
    return sha256(buffer);
  }

  async getOcrPages(contentHash: string): Promise<PageText[] | null> {
    const key = this.ocrKey(contentHash);
    const raw = memoryGet(key) ?? (await redisGet(key));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PageText[];
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async setOcrPages(contentHash: string, pages: PageText[]): Promise<void> {
    const key = this.ocrKey(contentHash);
    const raw = JSON.stringify(pages);
    const ttl = env.cache.ocrTtlSec;
    memorySet(key, raw, ttl);
    await redisSet(key, raw, ttl);
  }

  async getOpenAiFieldVerify(cacheKey: string): Promise<FieldVerificationOutput | null> {
    const raw = memoryGet(cacheKey) ?? (await redisGet(cacheKey));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FieldVerificationOutput;
    } catch {
      return null;
    }
  }

  async setOpenAiFieldVerify(
    cacheKey: string,
    output: FieldVerificationOutput
  ): Promise<void> {
    const raw = JSON.stringify(output);
    const ttl = env.cache.openaiTtlSec;
    memorySet(cacheKey, raw, ttl);
    await redisSet(cacheKey, raw, ttl);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = memoryGet(key) ?? (await redisGet(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    const raw = JSON.stringify(value);
    memorySet(key, raw, ttlSec);
    await redisSet(key, raw, ttlSec);
  }
}

export const pipelineCacheService = new PipelineCacheService();
