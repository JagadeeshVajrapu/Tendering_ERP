import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { tenderParameterAliasMappingService } from '../services/tenderParameter/tenderParameterAliasMappingService';

/** GET /api/debug/:documentId/alias-mapping */
export const getDocumentAliasMapping = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const result = await tenderParameterAliasMappingService.getDocumentAliasMappings(documentId);
  sendSuccess(res, result);
});

/** POST /api/debug/alias-mapping/preview — preview alias map for a single label */
export const previewAliasMapping = asyncHandler(async (req: AuthRequest, res: Response) => {
  const label = String(req.body?.label || '').trim();
  const mapped = tenderParameterAliasMappingService.mapLabel(label);
  sendSuccess(res, mapped);
});
