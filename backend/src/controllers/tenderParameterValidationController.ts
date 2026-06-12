import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { tenderParameterValidationService } from '../services/tenderParameter/tenderParameterValidationService';
import { getEnterpriseValidationRuleSummary } from '../services/tenderParameter/enterpriseTenderValidationEngine';

/** GET /api/debug/:documentId/validation-dashboard */
export const getDocumentValidationDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const result = await tenderParameterValidationService.getValidationDashboard(documentId);
  sendSuccess(res, result);
});

/** GET /api/tender/foundation/validation-engine */
export const getFoundationValidationEngine = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getEnterpriseValidationRuleSummary());
});
