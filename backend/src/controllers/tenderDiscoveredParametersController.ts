import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { AppError } from '../middleware/errorHandler';
import { parameterDiscoveryService } from '../services/parameterDiscovery/parameterDiscoveryService';

/** GET /api/tender/:id/discovered-parameters — every parameter:value pair (parameter, value, page, confidence) */
export const getTenderDiscoveredParameters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const engine = await parameterDiscoveryService.runEngineForDocument(
    document._id,
    document.tenderId,
    refresh
  );

  sendSuccess(res, {
    ...engine,
    originalName: document.originalName,
  });
});
