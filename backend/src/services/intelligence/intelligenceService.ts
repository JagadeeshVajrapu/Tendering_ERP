import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { IntelligenceJob } from '../../models/IntelligenceJob';
import { TenderIntelligence } from '../../models/TenderIntelligence';
import { TenderDocument } from '../../models/TenderDocument';
import { uploadService } from '../upload/uploadService';
import { addTenderAnalysisJob } from '../../queues/queueService';
import { jobStatusService } from '../jobs/jobStatusService';

class IntelligenceService {
  async uploadAndQueue(
    file: Express.Multer.File,
    userId: Types.ObjectId,
    options: { title?: string; tenderId?: string }
  ) {
    const { tender, document } = await uploadService.saveTenderDocument(file, userId, options);

    const job = await IntelligenceJob.create({
      tenderId: tender!._id,
      documentId: document!._id,
      status: 'queued',
      progress: 0,
      createdBy: userId,
    });

    await TenderDocument.findByIdAndUpdate(document!._id, { intelligenceJobId: job._id });

    const payload = {
      jobId: String(job._id),
      tenderId: String(tender!._id),
      documentId: String(document!._id),
      userId: String(userId),
    };

    const { queueJobId } = await addTenderAnalysisJob(payload);

    return {
      tender,
      document,
      job: await IntelligenceJob.findById(job._id),
      queueJobId,
      queueJob: await jobStatusService.getJobStatus(queueJobId),
      message: 'Document uploaded successfully. Analyzing tender document...',
    };
  }

  async requeue(tenderId: string, userId: Types.ObjectId) {
    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) throw new AppError('No document found. Upload a tender document first.', 404);

    const job = await IntelligenceJob.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: document._id,
      status: 'queued',
      progress: 0,
      createdBy: userId,
    });

    await TenderDocument.findByIdAndUpdate(document._id, { intelligenceJobId: job._id });

    const { queueJobId } = await addTenderAnalysisJob({
      jobId: String(job._id),
      tenderId,
      documentId: String(document._id),
      userId: String(userId),
      refresh: true,
    });

    return { job, queueJobId };
  }

  async getJobStatus(tenderId: string) {
    const job = await IntelligenceJob.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!job) throw new AppError('No intelligence job found for this tender.', 404);
    return job;
  }

  async getIntelligence(tenderId: string) {
    const intelligence = await TenderIntelligence.findOne({ tenderId })
      .sort({ createdAt: -1 })
      .populate('analyzedBy', 'name email role');

    if (!intelligence) {
      throw new AppError('No analysis results yet. Upload a document to begin.', 404);
    }

    const job = await IntelligenceJob.findById(intelligence.jobId);
    return { intelligence, job };
  }
}

export const intelligenceService = new IntelligenceService();
