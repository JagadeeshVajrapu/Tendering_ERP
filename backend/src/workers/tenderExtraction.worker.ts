import { Worker, Job } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis';
import { env } from '../config/env';
import { QUEUE_NAMES } from '../queues/constants';
import { TenderExtractionJobPayload } from '../queues/types';
import { jobStatusService } from '../services/jobs/jobStatusService';
import { tenderExtractionPipeline } from '../services/tenderExtraction/tenderExtractionPipeline';

export function createTenderExtractionWorker(): Worker<TenderExtractionJobPayload> {
  const worker = new Worker<TenderExtractionJobPayload>(
    QUEUE_NAMES.TENDER_EXTRACTION,
    async (job: Job<TenderExtractionJobPayload>) => {
      const { queueJobId } = job.data;
      await jobStatusService.setActive(queueJobId);
      await job.updateProgress(0);

      await tenderExtractionPipeline.run(job.data);

      await jobStatusService.setCompleted(queueJobId);
      await job.updateProgress(100);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: Math.max(1, Math.floor(env.redis.workerConcurrency / 2)),
    }
  );

  worker.on('failed', async (job, err) => {
    if (job?.data.queueJobId) {
      await jobStatusService.setFailed(job.data.queueJobId, err.message);
    }
    console.error(`[Worker:${QUEUE_NAMES.TENDER_EXTRACTION}] Job ${job?.id} failed:`, err.message);
  });

  console.log(`[Worker] ${QUEUE_NAMES.TENDER_EXTRACTION} started`);
  return worker;
}

