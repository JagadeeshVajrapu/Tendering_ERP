import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, getRedisConnectionOptions } from '../config/redis';
import { QUEUE_NAMES } from './constants';
import { ReportGenerationJobPayload } from './types';

let reportGenerationQueue: Queue<ReportGenerationJobPayload> | null = null;

export function getReportGenerationQueue(): Queue<ReportGenerationJobPayload> {
  if (!reportGenerationQueue) {
    reportGenerationQueue = new Queue<ReportGenerationJobPayload>(QUEUE_NAMES.REPORT_GENERATION, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return reportGenerationQueue;
}

export async function closeReportGenerationQueue(): Promise<void> {
  await reportGenerationQueue?.close();
  reportGenerationQueue = null;
}
