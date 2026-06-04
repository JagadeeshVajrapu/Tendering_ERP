import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, getRedisConnectionOptions } from '../config/redis';
import { QUEUE_NAMES } from './constants';
import { TenderAnalysisJobPayload } from './types';

let tenderAnalysisQueue: Queue<TenderAnalysisJobPayload> | null = null;

export function getTenderAnalysisQueue(): Queue<TenderAnalysisJobPayload> {
  if (!tenderAnalysisQueue) {
    tenderAnalysisQueue = new Queue<TenderAnalysisJobPayload>(QUEUE_NAMES.TENDER_ANALYSIS, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return tenderAnalysisQueue;
}

export async function closeTenderAnalysisQueue(): Promise<void> {
  await tenderAnalysisQueue?.close();
  tenderAnalysisQueue = null;
}
