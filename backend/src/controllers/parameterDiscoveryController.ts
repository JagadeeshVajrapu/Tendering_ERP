import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { parameterDiscoveryService } from '../services/parameterDiscovery/parameterDiscoveryService';

/** GET /api/debug/:documentId/parameters — Dynamic Parameter Discovery (all pairs, no fixed schema) */
export const getDiscoveredParameters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const payload = await parameterDiscoveryService.getDiscoveredParameters(documentId, refresh);
  sendSuccess(res, payload);
});
