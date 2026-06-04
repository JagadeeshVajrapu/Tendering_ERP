import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { tenderExecutiveRecommendationService } from '../services/recommendation/tenderExecutiveRecommendationService';

/** GET /api/tender/:id/recommendation — executive bid recommendation from verified dataset + risks. */
export const getTenderRecommendation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const payload = await tenderExecutiveRecommendationService.getOrGenerateForTender(
    new Types.ObjectId(tenderId)
  );
  sendSuccess(res, payload);
});
