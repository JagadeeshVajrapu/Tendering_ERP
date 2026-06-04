import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { nitAnalysisGeneratorService } from '../services/nit/nitAnalysisGeneratorService';

/** GET /api/tender/:id/nit-analysis — Dynamic Parameters → Mapping → Master Dataset → NIT sections. */
export const getTenderNitAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const report = await nitAnalysisGeneratorService.generateForTender(new Types.ObjectId(tenderId), {
    refresh,
  });
  sendSuccess(res, report);
});
