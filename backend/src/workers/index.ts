import { Worker } from 'bullmq';
import { env } from '../config/env';
import { closeRedis, connectRedis, isRedisAvailable } from '../config/redis';
import { createTenderAnalysisWorker } from './tenderAnalysis.worker';
import { createReportGenerationWorker } from './reportGeneration.worker';
import { createTenderExtractionWorker } from './tenderExtraction.worker';

const WORKER_RETRIES = 15;
const WORKER_RETRY_MS = 2000;

let tenderAnalysisWorker: Worker | null = null;
let reportGenerationWorker: Worker | null = null;
let tenderExtractionWorker: Worker | null = null;

export async function startWorkers(): Promise<void> {
  if (!env.redis.enabled) {
    console.log('[Workers] Redis disabled — jobs run inline in API process');
    return;
  }

  const connected = await connectRedis();
  if (!connected) {
    console.warn('[Workers] Redis not reachable — jobs will run inline in the API process');
    console.warn('[Workers] Start Redis on 127.0.0.1:6379 or set REDIS_ENABLED=false in .env');
    return;
  }

  if (!tenderAnalysisWorker) {
    tenderAnalysisWorker = createTenderAnalysisWorker();
  }
  if (!reportGenerationWorker) {
    reportGenerationWorker = createReportGenerationWorker();
  }
  if (!tenderExtractionWorker) {
    tenderExtractionWorker = createTenderExtractionWorker();
  }
}

export async function stopWorkers(): Promise<void> {
  await tenderAnalysisWorker?.close();
  await reportGenerationWorker?.close();
  await tenderExtractionWorker?.close();
  tenderAnalysisWorker = null;
  reportGenerationWorker = null;
  tenderExtractionWorker = null;
}

async function waitForRedis(): Promise<boolean> {
  for (let attempt = 1; attempt <= WORKER_RETRIES; attempt++) {
    const ok = await connectRedis();
    if (ok) return true;
    console.warn(
      `[Workers] Waiting for Redis (${attempt}/${WORKER_RETRIES}) — start Redis then retry…`
    );
    await closeRedis();
    if (attempt < WORKER_RETRIES) {
      await new Promise((r) => setTimeout(r, WORKER_RETRY_MS));
    }
  }
  return false;
}

/** Standalone worker entrypoint: `npm run worker` */
async function main(): Promise<void> {
  const { connectDatabase } = await import('../config/database');
  await connectDatabase();

  if (!env.redis.enabled) {
    console.log('[Workers] REDIS_ENABLED=false — no worker needed. Use npm run dev only.');
    process.exit(0);
  }

  const connected = await waitForRedis();
  if (!connected) {
    console.error('');
    console.error('[Workers] Could not connect to Redis at', env.redis.url);
    console.error('');
    console.error('  Option A — Docker (recommended):');
    console.error('    cd .. && docker compose up -d redis');
    console.error('    redis-cli ping   # should return PONG');
    console.error('');
    console.error('  Option B — Local Redis / Memurai: start the Redis service, then:');
    console.error('    redis-cli ping');
    console.error('');
    console.error('  Option C — No Redis (inline jobs in API only):');
    console.error('    Set REDIS_ENABLED=false in backend/.env');
    console.error('    Run only: npm run dev  (do not run npm run worker)');
    console.error('');
    process.exit(1);
  }

  await startWorkers();

  if (!isRedisAvailable()) {
    console.error('[Workers] Redis connection lost after start.');
    process.exit(1);
  }

  console.log('[Workers] Standalone worker process running (Ctrl+C to stop)');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Workers] Fatal error:', err);
    process.exit(1);
  });
}
