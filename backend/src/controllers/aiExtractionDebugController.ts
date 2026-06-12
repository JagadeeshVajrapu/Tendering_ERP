import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { aiExtractionDebugService } from '../services/tenderParameter/aiExtractionDebugService';

/** GET /api/debug/:documentId/ai-extraction */
export const getDocumentAiExtraction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const result = await aiExtractionDebugService.getDashboard(documentId, refresh);
  sendSuccess(res, result);
});

/** GET /api/tender/:id/ai-extraction */
export const getTenderAiExtraction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await aiExtractionDebugService.getDashboard(String(document._id), refresh);
  sendSuccess(res, result);
});
