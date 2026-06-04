import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { labelValueService } from '../services/labelValue/labelValueService';

/** GET /api/debug/:documentId/label-values — generic label : value pairs (all pages). */
export const getLabelValuePairs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const payload = await labelValueService.getLabelValuePairs(documentId, refresh);
  sendSuccess(res, payload);
});
