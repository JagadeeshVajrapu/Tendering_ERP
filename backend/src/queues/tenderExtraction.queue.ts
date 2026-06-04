import { Queue } from 'bullmq';
import { DEFAULT_JOB_OPTIONS, getRedisConnectionOptions } from '../config/redis';
import { QUEUE_NAMES } from './constants';
import { TenderExtractionJobPayload } from './types';

let queue: Queue<TenderExtractionJobPayload> | null = null;

export function getTenderExtractionQueue(): Queue<TenderExtractionJobPayload> {
  if (!queue) {
    queue = new Queue<TenderExtractionJobPayload>(QUEUE_NAMES.TENDER_EXTRACTION, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return queue;
}

