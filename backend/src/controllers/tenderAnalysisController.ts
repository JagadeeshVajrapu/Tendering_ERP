import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';

import { asyncHandler, AppError } from '../middleware/errorHandler';

import { sendSuccess } from '../utils/apiResponse';

import { paramId } from '../utils/params';

import { intelligenceService } from '../services/intelligence/intelligenceService';

import { tenderAnalysisService } from '../services/analysis/tenderAnalysisService';

import { feasibilityReportService } from '../services/report/feasibilityReportService';
import { enterpriseFeasibilityWorkflowService } from '../services/report/enterpriseFeasibilityWorkflowService';
import { MdFeasibilityAction } from '../types/enterpriseFeasibilityReport';
import { fileStorageService } from '../services/storage/fileStorageService';



export const uploadTender = asyncHandler(async (req: AuthRequest, res: Response) => {

  const file = req.file;

  if (!file) throw new AppError('No file uploaded. Send multipart form with field "file".', 400);



  const { title, tenderId } = req.body as { title?: string; tenderId?: string };



  const { tender, document, job, queueJobId, queueJob, message } =
    await intelligenceService.uploadAndQueue(file, req.user!._id, { title, tenderId });

  sendSuccess(
    res,
    {
      tender,
      document: {
        id: document!._id,
        originalName: document!.originalName,
        mimeType: document!.mimeType,
        fileSize: document!.fileSize,
        pageCount: document!.pageCount,
        localPath: document!.localPath,
        url: document!.s3Url,
      },
      job: {
        id: job!._id,
        status: job!.status,
        progress: job!.progress,
      },
      queueJobId,
      queueJob,
      message,
    },
    message,
    200
  );
});



export const getTenderAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);

  let intelligence = null;
  let job = null;

  try {
    job = await intelligenceService.getJobStatus(tenderId);
  } catch {
    // no job yet
  }

  try {
    const intel = await intelligenceService.getIntelligence(tenderId);
    intelligence = intel.intelligence;
    job = intel.job;
  } catch {
    // analysis not complete yet
  }

  try {
    const result = await tenderAnalysisService.getAnalysis(tenderId);
    sendSuccess(res, { ...result, intelligence, job });
  } catch {
    // Expected for new tenders before first upload/analysis — not an error for the UI.
    sendSuccess(res, {
      analysis: null,
      tender: null,
      report: null,
      intelligence,
      job,
    });
  }
});



export const getIntelligenceJob = asyncHandler(async (req: AuthRequest, res: Response) => {

  const job = await intelligenceService.getJobStatus(paramId(req.params.id));

  sendSuccess(res, { job });

});



export const getTenderIntelligence = asyncHandler(async (req: AuthRequest, res: Response) => {

  const result = await intelligenceService.getIntelligence(paramId(req.params.id));

  sendSuccess(res, result);

});



export const reanalyzeTender = asyncHandler(async (req: AuthRequest, res: Response) => {

  const job = await intelligenceService.requeue(paramId(req.params.id), req.user!._id);

  sendSuccess(res, { job }, 'Intelligence re-analysis queued');

});



export const generateFeasibilityReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const result = await feasibilityReportService.generateReport(tenderId, req.user!._id);
  sendSuccess(res, result, 'Enterprise MD feasibility report generated');
});



export const getFeasibilityReport = asyncHandler(async (req: AuthRequest, res: Response) => {

  const result = await feasibilityReportService.getLatestReport(paramId(req.params.id));

  sendSuccess(res, result);

});



export const mdTenderDecision = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const { decision, remarks, action } = req.body as {
    decision?: 'APPROVED' | 'REJECTED';
    remarks?: string;
    action?: MdFeasibilityAction;
  };

  const mdAction: MdFeasibilityAction =
    action || (decision === 'APPROVED' ? 'approve' : 'reject');

  const report = await enterpriseFeasibilityWorkflowService.mdAction(
    tenderId,
    mdAction,
    req.user!._id,
    req.user!.role,
    remarks
  );

  sendSuccess(
    res,
    { report, tenderId },
    mdAction === 'approve' ? 'Tender approved' : 'MD action recorded'
  );
});

/** POST /api/tenders/:id/feasibility/md-action */
export const mdFeasibilityAction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const { action, comments } = req.body as { action: MdFeasibilityAction; comments?: string };

  const report = await enterpriseFeasibilityWorkflowService.mdAction(
    tenderId,
    action,
    req.user!._id,
    req.user!.role,
    comments
  );

  sendSuccess(res, { report }, 'MD feasibility action recorded');
});



export const downloadFeasibilityReport = asyncHandler(async (req: AuthRequest, res: Response) => {

  const { report } = await feasibilityReportService.getLatestReport(paramId(req.params.id));

  const absolutePath = fileStorageService.getAbsolutePath(report.pdfPath);

  res.download(absolutePath, report.pdfFileName);

});

