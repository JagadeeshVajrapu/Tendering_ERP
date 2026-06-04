import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { fieldLocatorService } from '../services/fieldLocator/fieldLocatorService';

/** GET /api/debug/:documentId/fields — rule-based field locator (first 10 pages, no AI). */
export const getDocumentFields = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const payload = await fieldLocatorService.getFieldsDebug(documentId);
  sendSuccess(res, payload);
});
