import { Worker, Job } from 'bullmq';

import { getRedisConnectionOptions } from '../config/redis';

import { env } from '../config/env';

import { QUEUE_NAMES } from '../queues/constants';

import { TenderAnalysisJobPayload } from '../queues/types';

import { intelligencePipeline } from '../services/intelligence/intelligencePipeline';

import { jobStatusService } from '../services/jobs/jobStatusService';



export function createTenderAnalysisWorker(): Worker<TenderAnalysisJobPayload> {

  const worker = new Worker<TenderAnalysisJobPayload>(

    QUEUE_NAMES.TENDER_ANALYSIS,

    async (job: Job<TenderAnalysisJobPayload>) => {

      const { queueJobId } = job.data;

      await jobStatusService.setActive(queueJobId);

      await job.updateProgress(0);



      await intelligencePipeline.runAnalysis(job.data);



      await jobStatusService.setCompleted(queueJobId);

      await job.updateProgress(100);

    },

    {

      connection: getRedisConnectionOptions(),
      concurrency: env.redis.workerConcurrency,
      lockDuration: 120_000,
      stalledInterval: 60_000,
    }

  );



  worker.on('active', async (job) => {

    if (job.data.queueJobId) {

      await jobStatusService.setActive(job.data.queueJobId);

    }

  });



  worker.on('progress', async (job, progress) => {

    if (job.data.queueJobId && typeof progress === 'number') {

      await jobStatusService.updateProgress(job.data.queueJobId, progress, 'active');

    }

  });



  worker.on('completed', async (job) => {

    if (job.data.queueJobId) {

      await jobStatusService.setCompleted(job.data.queueJobId);

    }

    console.log(`[Worker:${QUEUE_NAMES.TENDER_ANALYSIS}] Job ${job.id} completed`);

  });



  worker.on('failed', async (job, err) => {

    if (job?.data.queueJobId) {

      await jobStatusService.setFailed(job.data.queueJobId, err.message);

    }

    console.error(`[Worker:${QUEUE_NAMES.TENDER_ANALYSIS}] Job ${job?.id} failed:`, err.message);

  });



  console.log(`[Worker] ${QUEUE_NAMES.TENDER_ANALYSIS} started (concurrency: ${env.redis.workerConcurrency})`);

  return worker;

}

