import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { tenderParameterCandidateExtractionService } from '../services/tenderParameter/tenderParameterCandidateExtractionService';

/** GET /api/debug/:documentId/parameter-candidates */
export const getDocumentParameterCandidates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const result = await tenderParameterCandidateExtractionService.getCandidates(documentId, refresh);
  sendSuccess(res, result);
});

/** GET /api/tender/:id/parameter-candidates */
export const getTenderParameterCandidates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await tenderParameterCandidateExtractionService.getCandidates(
    String(document._id),
    refresh
  );
  sendSuccess(res, result);
});
