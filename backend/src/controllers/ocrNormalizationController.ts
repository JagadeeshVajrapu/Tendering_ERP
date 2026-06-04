import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { ocrNormalizationService } from '../services/ocr/ocrNormalizationService';
import { TenderDocument } from '../models/TenderDocument';

/** GET /api/debug/:documentId/ocr-normalization — structured Label | Value | Page */
export const getDocumentOcrNormalization = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = new Types.ObjectId(paramId(req.params.documentId));
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const document = await TenderDocument.findById(documentId);
  const result = await ocrNormalizationService.getOrNormalize(documentId, { refresh });

  sendSuccess(res, {
    ...result,
    originalName: document?.originalName,
  });
});
