import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { datasetDebugService } from '../services/masterDataset/datasetDebugService';

/** GET /api/debug/dataset?documentId= — field locator vs OpenAI vs final master dataset. */
export const getDatasetDebug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId.trim() : '';
  if (!documentId) {
    throw new AppError('Query parameter documentId is required', 400);
  }
  const payload = await datasetDebugService.getDatasetFlowFull(documentId);
  sendSuccess(res, payload);
});
