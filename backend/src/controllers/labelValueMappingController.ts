import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { TenderDocument } from '../models/TenderDocument';
import { AppError } from '../middleware/errorHandler';
import { labelValueMappingService } from '../services/labelValue/labelValueMappingService';
import { getMappingTableForDisplay } from '../services/labelValue/labelValueFieldMapping';

/** GET /api/debug/:documentId/label-mappings — map label–value pairs → canonical fields */
export const getLabelValueMappings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  const payload = await labelValueMappingService.mapDocument(
    document._id,
    document.tenderId,
    refresh
  );
  sendSuccess(res, payload);
});

/** GET /api/debug/label-mapping-table — static alias → field reference */
export const getLabelMappingTable = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, { mappings: getMappingTableForDisplay() });
});
