import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { uploadService } from '../services/upload/uploadService';
import { TenderExtraction } from '../models/TenderExtraction';
import { addTenderExtractionJob } from '../queues/queueService';
import { paramId } from '../utils/params';

export const uploadTenderForExtraction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('No file uploaded. Send multipart form with field "file".', 400);

  const { title, tenderId } = req.body as { title?: string; tenderId?: string };

  const { tender, document } = await uploadService.saveTenderDocument(file, req.user!._id, { title, tenderId });

  const extraction = await TenderExtraction.create({
    tenderId: tender!._id,
    documentId: document!._id,
    status: 'uploaded',
    progress: 0,
    extractedFields: [],
    createdBy: req.user!._id,
  });

  const { queueJobId } = await addTenderExtractionJob({
    tenderId: String(tender!._id),
    documentId: String(document!._id),
    extractionId: String(extraction._id),
    userId: String(req.user!._id),
  });

  sendSuccess(
    res,
    {
      tender,
      document: { id: document!._id, originalName: document!.originalName, mimeType: document!.mimeType },
      extraction: { id: extraction._id, status: extraction.status, progress: extraction.progress },
      queueJobId,
    },
    'Document uploaded. Extraction queued.',
    200
  );
});

export const getTenderExtraction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const extraction = await TenderExtraction.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!extraction) throw new AppError('No extraction found for this tender.', 404);
  sendSuccess(res, { extraction });
});

export const getTenderExtractionByDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const documentId = paramId(req.params.documentId);
  const extraction = await TenderExtraction.findOne({ tenderId, documentId }).sort({ createdAt: -1 });
  if (!extraction) throw new AppError('No extraction found for this document.', 404);
  sendSuccess(res, { extraction });
});

