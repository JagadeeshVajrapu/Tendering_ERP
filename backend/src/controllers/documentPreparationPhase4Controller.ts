import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { documentPreparationService } from '../services/documentPreparation/documentPreparationService';
import { preparationSigningService } from '../services/documentPreparation/preparationSigningService';
import {
  CreateSigningWorkflowRequest,
  DscSignRequest,
  DscVerifyRequest,
  ElectronicSignRequest,
  PdfMarkupRequest,
  PdfUnlockRequest,
} from '../types/documentPreparation';

function tenderIdParam(req: AuthRequest): string {
  return paramId(req.params.id);
}

function requestContext(req: AuthRequest) {
  return {
    userId: req.user!._id,
    userRole: req.user!.role,
    userName: req.user!.name,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || undefined,
  };
}

/** POST /api/tender/:id/document-preparation/pdf/unlock */
export const unlockPreparationPdf = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.unlockPdf(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfUnlockRequest
  );
  sendSuccess(res, result, 'PDF unlocked', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/markup */
export const applyPreparationMarkup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as PdfMarkupRequest;
  const result = await preparationSigningService.saveMarkup(
    tenderIdParam(req),
    requestContext(req),
    body
  );
  sendSuccess(res, result, 'Markup applied', 201);
});

/** GET /api/tender/:id/document-preparation/signing/workflows */
export const listPreparationSigningWorkflows = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = req.query.documentId ? String(req.query.documentId) : undefined;
  const result = await preparationSigningService.listWorkflows(tenderIdParam(req), documentId);
  sendSuccess(res, result);
});

/** POST /api/tender/:id/document-preparation/signing/workflows */
export const createPreparationSigningWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.createWorkflow(
    tenderIdParam(req),
    requestContext(req),
    req.body as CreateSigningWorkflowRequest
  );
  sendSuccess(res, result, 'Signing workflow created', 201);
});

/** GET /api/tender/:id/document-preparation/signing/workflows/:workflowId */
export const getPreparationSigningWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.getWorkflow(
    tenderIdParam(req),
    paramId(req.params.workflowId)
  );
  sendSuccess(res, result);
});

/** POST /api/tender/:id/document-preparation/signing/workflows/:workflowId/start */
export const startPreparationSigningWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.startWorkflow(
    tenderIdParam(req),
    paramId(req.params.workflowId),
    requestContext(req)
  );
  sendSuccess(res, result, 'Workflow started');
});

/** POST /api/tender/:id/document-preparation/signing/workflows/:workflowId/cancel */
export const cancelPreparationSigningWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.cancelWorkflow(
    tenderIdParam(req),
    paramId(req.params.workflowId),
    requestContext(req)
  );
  sendSuccess(res, result, 'Workflow cancelled');
});

/** POST /api/tender/:id/document-preparation/signing/workflows/:workflowId/esign */
export const applyPreparationElectronicSign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.applyElectronicSignature(
    tenderIdParam(req),
    paramId(req.params.workflowId),
    requestContext(req),
    req.body as ElectronicSignRequest
  );
  sendSuccess(res, result, 'Electronic signature applied', 201);
});

/** POST /api/tender/:id/document-preparation/signing/workflows/:workflowId/dsc-sign */
export const applyPreparationDscSign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.applyDscSignature(
    tenderIdParam(req),
    paramId(req.params.workflowId),
    requestContext(req),
    req.body as DscSignRequest
  );
  sendSuccess(res, result, 'DSC signature recorded', 201);
});

/** POST /api/tender/:id/document-preparation/signing/documents/:docId/verify-dsc */
export const verifyPreparationDsc = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.verifyDocumentDsc(
    tenderIdParam(req),
    paramId(req.params.docId),
    (req.body as DscVerifyRequest).certificatePem
  );
  sendSuccess(res, result);
});

/** GET /api/tender/:id/document-preparation/signing/documents/:docId/history */
export const getPreparationSignatureHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.getSignatureHistory(
    tenderIdParam(req),
    paramId(req.params.docId)
  );
  sendSuccess(res, result);
});

/** GET /api/tender/:id/document-preparation/signing/workflows/:workflowId/audit-trail */
export const getPreparationWorkflowAuditTrail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await preparationSigningService.getWorkflowAuditTrail(
    tenderIdParam(req),
    paramId(req.params.workflowId)
  );
  sendSuccess(res, result);
});

/** GET /api/tender/:id/document-preparation/audit-logs */
export const getPreparationAuditLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = req.query.documentId ? String(req.query.documentId) : undefined;
  const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

  if (!documentId) {
    const { preparationAuditService } = await import(
      '../services/documentPreparation/preparationAuditService'
    );
    const { AuditLog } = await import('../models/AuditLog');
    const logs = await AuditLog.find({ entityType: 'preparation_document' })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const filtered = logs.filter(
      (l) => (l.metadata as Record<string, unknown> | undefined)?.tenderId === tenderIdParam(req)
    );
    sendSuccess(res, { logs: filtered, page, limit });
    return;
  }

  const result = await preparationSigningService.getDocumentAuditLogs(
    tenderIdParam(req),
    documentId,
    page,
    limit
  );
  sendSuccess(res, result);
});
