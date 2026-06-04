import type { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { env } from './env';

let sharedConnection: Redis | null = null;
let redisAvailable = false;

function parseRedisEndpoint(): { host: string; port: number; password?: string } {
  try {
    const url = new URL(env.redis.url);
    return {
      host: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname || '127.0.0.1',
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

function attachErrorHandler(client: Redis): void {
  client.removeAllListeners('error');
  client.on('error', (err) => {
    console.warn('[Redis] Client error:', err.message);
  });
}

/** ioredis options — must NOT use lazyConnect + enableOfflineQueue:false (ping fails). */
function createClientOptions(): Redis['options'] {
  const { host, port, password } = parseRedisEndpoint();
  return {
    host,
    port,
    password,
    family: 4,
    maxRetriesPerRequest: null,
    lazyConnect: false,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    connectTimeout: 10_000,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 300, 2000)),
  };
}

/** BullMQ connection (separate from shared ioredis client). */
export function getRedisConnectionOptions(): ConnectionOptions {
  const { host, port, password } = parseRedisEndpoint();
  return {
    host,
    port,
    password,
    family: 4,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 10_000,
  };
}

export function getRedisClient(): Redis {
  if (!sharedConnection) {
    sharedConnection = new Redis(createClientOptions());
    attachErrorHandler(sharedConnection);
  }
  return sharedConnection;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function connectRedis(): Promise<boolean> {
  if (!env.redis.enabled) return false;

  let probe: Redis | null = null;

  try {
    if (sharedConnection?.status === 'ready') {
      await sharedConnection.ping();
      redisAvailable = true;
      return true;
    }

    await closeRedis();

    probe = new Redis(createClientOptions());
    attachErrorHandler(probe);
    await probe.ping();

    sharedConnection = probe;
    probe = null;
    redisAvailable = true;
    const { host, port } = parseRedisEndpoint();
    console.log('[Redis] Connected successfully at', `${host}:${port}`);
    return true;
  } catch (err) {
    console.warn('[Redis] Connection failed:', err instanceof Error ? err.message : err);
    if (probe) {
      try {
        probe.disconnect();
      } catch {
        // ignore
      }
    }
    redisAvailable = false;
    sharedConnection = null;
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (sharedConnection) {
    try {
      await sharedConnection.quit();
    } catch {
      try {
        sharedConnection.disconnect();
      } catch {
        // ignore
      }
    }
    sharedConnection = null;
  }
  redisAvailable = false;
}

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 200,
  removeOnFail: 100,
};
