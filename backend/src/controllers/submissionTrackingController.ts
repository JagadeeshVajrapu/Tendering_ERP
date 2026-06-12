import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { submissionTrackingService } from '../services/submissionTracking/submissionTrackingService';

function tenderIdParam(req: AuthRequest): string {
  return paramId(req.params.id);
}

function requestContext(req: AuthRequest) {
  return {
    userId: req.user!._id,
    userRole: req.user!.role,
    userName: req.user!.name,
    ipAddress: req.ip,
  };
}

/** GET /api/tenders/:id/submission-tracking */
export const getSubmissionTrackingDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await submissionTrackingService.getDashboard(tenderIdParam(req), requestContext(req));
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/submission-tracking/ready */
export const markSubmissionReady = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await submissionTrackingService.markReady(tenderIdParam(req), requestContext(req));
  sendSuccess(res, result, 'Marked ready for submission');
});

/** POST /api/tenders/:id/submission-tracking/lock */
export const lockSubmission = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await submissionTrackingService.verifyAndLock(tenderIdParam(req), requestContext(req));
  sendSuccess(res, result, 'Submission verified and locked');
});

/** POST /api/tenders/:id/submission-tracking/submit */
export const markSubmissionSubmitted = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await submissionTrackingService.markSubmitted(
    tenderIdParam(req),
    requestContext(req),
    req.body?.notes
  );
  sendSuccess(res, result, 'Tender marked as submitted');
});

/** POST /api/tenders/:id/submission-tracking/screenshots */
export const uploadSubmissionScreenshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('Screenshot file is required', 400);

  const result = await submissionTrackingService.uploadScreenshot(
    tenderIdParam(req),
    requestContext(req),
    file,
    req.body?.caption
  );
  sendSuccess(res, result, 'Submission proof uploaded', 201);
});

/** GET /api/tenders/:id/submission-tracking/screenshots/:screenshotId/download */
export const downloadSubmissionScreenshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, record } = await submissionTrackingService.getScreenshotFile(
    tenderIdParam(req),
    paramId(req.params.screenshotId)
  );
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${record.originalName}"`);
  res.send(buffer);
});

/** GET /api/tenders/:id/submission-tracking/screenshots/:screenshotId/preview */
export const previewSubmissionScreenshot = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, record } = await submissionTrackingService.getScreenshotFile(
    tenderIdParam(req),
    paramId(req.params.screenshotId)
  );
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Disposition', 'inline');
  res.send(buffer);
});

/** GET /api/tenders/:id/submission-tracking/timeline */
export const getSubmissionTimeline = asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const result = await submissionTrackingService.getTimeline(tenderIdParam(req), limit);
  sendSuccess(res, result);
});
