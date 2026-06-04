import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { jobStatusService } from '../services/jobs/jobStatusService';

export const getJobStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const status = await jobStatusService.getJobStatus(paramId(req.params.jobId));
    sendSuccess(res, status);
  } catch {
    throw new AppError('Job not found', 404);
  }
});
