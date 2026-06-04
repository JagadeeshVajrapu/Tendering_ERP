import { QueueJob, IQueueJob } from '../../models/QueueJob';
import { QueueJobStatus, JobStatusResponse } from '../../queues/types';

const ACTIVE_INTERNAL = new Set([
  'extracting_pages',
  'chunking',
  'analyzing',
  'merging',
  'validating',
  'generating_report',
]);

export function mapInternalToQueueStatus(internalStatus: string): QueueJobStatus {
  if (internalStatus === 'queued') return 'waiting';
  if (internalStatus === 'completed') return 'completed';
  if (internalStatus === 'failed') return 'failed';
  if (ACTIVE_INTERNAL.has(internalStatus)) return 'active';
  return 'active';
}

class JobStatusService {
  async createJob(data: Partial<IQueueJob>): Promise<IQueueJob> {
    return QueueJob.create(data);
  }

  async setWaiting(queueJobId: string, bullJobId?: string): Promise<void> {
    await QueueJob.findByIdAndUpdate(queueJobId, {
      status: 'waiting',
      ...(bullJobId ? { bullJobId } : {}),
    });
  }

  async setActive(queueJobId: string): Promise<void> {
    await QueueJob.findByIdAndUpdate(queueJobId, { status: 'active' });
  }

  async updateProgress(
    queueJobId: string,
    progress: number,
    status?: QueueJobStatus
  ): Promise<void> {
    await QueueJob.findByIdAndUpdate(queueJobId, {
      progress: Math.min(100, Math.max(0, progress)),
      ...(status ? { status } : {}),
    });
  }

  async setCompleted(queueJobId: string, result?: Record<string, unknown>): Promise<void> {
    await QueueJob.findByIdAndUpdate(queueJobId, {
      status: 'completed',
      progress: 100,
      ...(result ? { result } : {}),
    });
  }

  async setFailed(queueJobId: string, errorMessage: string): Promise<void> {
    await QueueJob.findByIdAndUpdate(queueJobId, {
      status: 'failed',
      errorMessage,
    });
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const job = await QueueJob.findById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    return this.toResponse(job);
  }

  toResponse(job: IQueueJob): JobStatusResponse {
    return {
      jobId: String(job._id),
      status: job.status,
      progress: job.progress,
      type: job.type,
      tenderId: String(job.tenderId),
      errorMessage: job.errorMessage,
    };
  }
}

export const jobStatusService = new JobStatusService();
