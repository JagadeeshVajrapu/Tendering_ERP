import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { enterpriseAliasValidationService } from '../services/tenderParameter/enterpriseAliasValidationService';

/** GET /api/debug/:documentId/alias-validation */
export const getDocumentAliasValidation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const result = await enterpriseAliasValidationService.getDashboard(documentId, refresh);
  sendSuccess(res, result);
});

/** GET /api/tender/foundation/alias-validation-engine */
export const getFoundationAliasValidationEngine = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, enterpriseAliasValidationService.getRegistry());
});

/** GET /api/tender/:id/alias-validation */
export const getTenderAliasValidation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await enterpriseAliasValidationService.getDashboard(String(document._id), refresh);
  sendSuccess(res, result);
});
