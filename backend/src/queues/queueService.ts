import { Types } from 'mongoose';
import { env } from '../config/env';
import { connectRedis } from '../config/redis';
import { QueueJob } from '../models/QueueJob';
import { jobStatusService } from '../services/jobs/jobStatusService';
import { intelligencePipeline } from '../services/intelligence/intelligencePipeline';
import { feasibilityReportService } from '../services/report/feasibilityReportService';
import { tenderExtractionPipeline } from '../services/tenderExtraction/tenderExtractionPipeline';
import { getTenderAnalysisQueue } from './tenderAnalysis.queue';
import { getReportGenerationQueue } from './reportGeneration.queue';
import { getTenderExtractionQueue } from './tenderExtraction.queue';
import { JOB_NAMES } from './constants';
import { TenderAnalysisJobPayload, ReportGenerationJobPayload, TenderExtractionJobPayload } from './types';

async function runInlineTenderAnalysis(payload: TenderAnalysisJobPayload): Promise<void> {
  await jobStatusService.setActive(payload.queueJobId);
  try {
    await intelligencePipeline.runAnalysis(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await jobStatusService.setFailed(payload.queueJobId, msg);
    throw err;
  }
}

async function runInlineReportGeneration(payload: ReportGenerationJobPayload): Promise<void> {
  await jobStatusService.setActive(payload.queueJobId);
  try {
    await jobStatusService.updateProgress(payload.queueJobId, 10, 'active');
    const result = await feasibilityReportService.generateReport(
      payload.tenderId,
      new Types.ObjectId(payload.userId)
    );
    await jobStatusService.setCompleted(payload.queueJobId, {
      reportId: String(result.report._id),
      pdfUrl: result.pdfUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await jobStatusService.setFailed(payload.queueJobId, msg);
    throw err;
  }
}

async function runInlineTenderExtraction(payload: TenderExtractionJobPayload): Promise<void> {
  await jobStatusService.setActive(payload.queueJobId);
  try {
    await tenderExtractionPipeline.run(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await jobStatusService.setFailed(payload.queueJobId, msg);
    throw err;
  }
}

/**
 * Enqueue full tender analysis (extract → validate → store).
 */
export async function addTenderAnalysisJob(
  payload: Omit<TenderAnalysisJobPayload, 'queueJobId'> & { queueJobId?: string }
): Promise<{ queueJobId: string; bullJobId?: string }> {
  let queueJobId = payload.queueJobId;

  if (!queueJobId) {
    const record = await jobStatusService.createJob({
      type: 'tender-analysis',
      status: 'waiting',
      progress: 0,
      tenderId: new Types.ObjectId(payload.tenderId),
      documentId: new Types.ObjectId(payload.documentId),
      intelligenceJobId: new Types.ObjectId(payload.jobId),
      userId: new Types.ObjectId(payload.userId),
    });
    queueJobId = String(record._id);
  }

  const fullPayload: TenderAnalysisJobPayload = {
    ...payload,
    queueJobId,
  };

  if (!env.redis.enabled) {
    setImmediate(() => {
      runInlineTenderAnalysis(fullPayload).catch(console.error);
    });
    return { queueJobId };
  }

  const connected = await connectRedis();
  if (!connected) {
    setImmediate(() => {
      runInlineTenderAnalysis(fullPayload).catch(console.error);
    });
    return { queueJobId };
  }

  try {
    const queue = getTenderAnalysisQueue();
    const bullJob = await queue.add(JOB_NAMES.PROCESS_BACKGROUND, fullPayload, {
      jobId: queueJobId,
    });
    await jobStatusService.setWaiting(queueJobId, bullJob.id);
    return { queueJobId, bullJobId: bullJob.id };
  } catch (err) {
    console.warn('[Queue] Redis unavailable — running tender analysis inline:', err);
    setImmediate(() => {
      runInlineTenderAnalysis(fullPayload).catch(console.error);
    });
    return { queueJobId };
  }
}

/**
 * Enqueue feasibility report generation for MD review.
 */
export async function addReportGenerationJob(
  tenderId: string,
  userId: Types.ObjectId
): Promise<{ queueJobId: string; bullJobId?: string }> {
  const record = await jobStatusService.createJob({
    type: 'report-generation',
    status: 'waiting',
    progress: 0,
    tenderId: new Types.ObjectId(tenderId),
    userId,
  });

  const queueJobId = String(record._id);
  const payload: ReportGenerationJobPayload = {
    queueJobId,
    tenderId,
    userId: String(userId),
  };

  if (!env.redis.enabled) {
    setImmediate(() => {
      runInlineReportGeneration(payload).catch(console.error);
    });
    return { queueJobId };
  }

  const connected = await connectRedis();
  if (!connected) {
    setImmediate(() => {
      runInlineReportGeneration(payload).catch(console.error);
    });
    return { queueJobId };
  }

  try {
    const queue = getReportGenerationQueue();
    const bullJob = await queue.add(JOB_NAMES.GENERATE_REPORT, payload, {
      jobId: `report-${queueJobId}`,
    });
    await jobStatusService.setWaiting(queueJobId, bullJob.id);
    return { queueJobId, bullJobId: bullJob.id };
  } catch (err) {
    console.warn('[Queue] Redis unavailable — running report generation inline:', err);
    setImmediate(() => {
      runInlineReportGeneration(payload).catch(console.error);
    });
    return { queueJobId };
  }
}

/**
 * Enqueue tender document extraction (text → clean → rule engine → validate → AI verify).
 */
export async function addTenderExtractionJob(
  payload: Omit<TenderExtractionJobPayload, 'queueJobId'> & { queueJobId?: string }
): Promise<{ queueJobId: string; bullJobId?: string }> {
  let queueJobId = payload.queueJobId;

  if (!queueJobId) {
    const record = await jobStatusService.createJob({
      type: 'tender-extraction',
      status: 'waiting',
      progress: 0,
      tenderId: new Types.ObjectId(payload.tenderId),
      documentId: new Types.ObjectId(payload.documentId),
      userId: new Types.ObjectId(payload.userId),
    });
    queueJobId = String(record._id);
  }

  const fullPayload: TenderExtractionJobPayload = {
    ...payload,
    queueJobId,
  };

  if (!env.redis.enabled) {
    setImmediate(() => {
      runInlineTenderExtraction(fullPayload).catch(console.error);
    });
    return { queueJobId };
  }

  const connected = await connectRedis();
  if (!connected) {
    setImmediate(() => {
      runInlineTenderExtraction(fullPayload).catch(console.error);
    });
    return { queueJobId };
  }

  try {
    const queue = getTenderExtractionQueue();
    const bullJob = await queue.add(JOB_NAMES.PROCESS_TENDER_EXTRACTION, fullPayload, {
      jobId: queueJobId,
    });
    await jobStatusService.setWaiting(queueJobId, bullJob.id);
    return { queueJobId, bullJobId: bullJob.id };
  } catch (err) {
    console.warn('[Queue] Redis unavailable — running tender extraction inline:', err);
    setImmediate(() => {
      runInlineTenderExtraction(fullPayload).catch(console.error);
    });
    return { queueJobId };
  }
}
