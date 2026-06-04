import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { getRedisConnectionOptions } from '../config/redis';
import { env } from '../config/env';
import { QUEUE_NAMES } from '../queues/constants';
import { ReportGenerationJobPayload } from '../queues/types';
import { feasibilityReportService } from '../services/report/feasibilityReportService';
import { jobStatusService } from '../services/jobs/jobStatusService';

export function createReportGenerationWorker(): Worker<ReportGenerationJobPayload> {
  const worker = new Worker<ReportGenerationJobPayload>(
    QUEUE_NAMES.REPORT_GENERATION,
    async (job: Job<ReportGenerationJobPayload>) => {
      const { queueJobId, tenderId, userId } = job.data;

      await jobStatusService.setActive(queueJobId);
      await job.updateProgress(10);

      const result = await feasibilityReportService.generateReport(
        tenderId,
        new Types.ObjectId(userId)
      );

      await jobStatusService.setCompleted(queueJobId, {
        reportId: String(result.report._id),
        pdfUrl: result.pdfUrl,
      });
      await job.updateProgress(100);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: env.redis.workerConcurrency,
    }
  );

  worker.on('active', async (job) => {
    await jobStatusService.setActive(job.data.queueJobId);
  });

  worker.on('failed', async (job, err) => {
    if (job?.data.queueJobId) {
      await jobStatusService.setFailed(job.data.queueJobId, err.message);
    }
    console.error(`[Worker:${QUEUE_NAMES.REPORT_GENERATION}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`[Worker:${QUEUE_NAMES.REPORT_GENERATION}] Job ${job.id} completed`);
  });

  console.log(`[Worker] ${QUEUE_NAMES.REPORT_GENERATION} started (concurrency: ${env.redis.workerConcurrency})`);
  return worker;
}
