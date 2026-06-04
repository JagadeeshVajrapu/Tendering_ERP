import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { tenderRiskAnalysisService } from '../services/risk/tenderRiskAnalysisService';

/** GET /api/tender/:id/risk-analysis — risk assessment from Master Tender Dataset only. */
export const getTenderRiskAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const payload = await tenderRiskAnalysisService.getOrAnalyzeForTender(new Types.ObjectId(tenderId));
  sendSuccess(res, payload);
});
