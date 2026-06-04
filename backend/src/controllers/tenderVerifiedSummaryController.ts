import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { tenderVerifiedSummaryService } from '../services/tender/tenderVerifiedSummaryService';

/** GET /api/tender/:id/verified-summary — fast flat table from stored master dataset. */
export const getTenderVerifiedSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const payload = await tenderVerifiedSummaryService.getForTenderWithRegenerate(
    new Types.ObjectId(tenderId)
  );
  sendSuccess(res, payload);
});
