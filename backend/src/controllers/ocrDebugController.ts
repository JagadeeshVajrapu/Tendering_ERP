import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { ocrDebugService } from '../services/ocr/ocrDebugService';

/** GET /api/debug/:documentId/pages — per-page OCR text for verification before extraction. */
export const getDocumentPages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const payload = await ocrDebugService.getPagesDebug(documentId);
  sendSuccess(res, payload);
});
