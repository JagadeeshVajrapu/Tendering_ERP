import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { financeTrackingService } from '../services/financeTracking/financeTrackingService';
import { FinanceRecordListQuery } from '../types/financeTracking';

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

function listQuery(req: AuthRequest): FinanceRecordListQuery {
  return {
    page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
    limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    recordType: req.query.recordType ? (String(req.query.recordType) as FinanceRecordListQuery['recordType']) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    sortBy: req.query.sortBy ? (String(req.query.sortBy) as FinanceRecordListQuery['sortBy']) : undefined,
    sortOrder: req.query.sortOrder ? (String(req.query.sortOrder) as 'asc' | 'desc') : undefined,
  };
}

/** GET /api/tenders/:id/finance */
export const getFinanceDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.getDashboard(
    tenderIdParam(req),
    requestContext(req),
    listQuery(req)
  );
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/finance/records */
export const createFinanceRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.createRecord(
    tenderIdParam(req),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Finance record created', 201);
});

/** PUT /api/tenders/:id/finance/records/:recordId */
export const updateFinanceRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.updateRecord(
    tenderIdParam(req),
    paramId(req.params.recordId),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Finance record updated');
});

/** DELETE /api/tenders/:id/finance/records/:recordId */
export const deleteFinanceRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  await financeTrackingService.deleteRecord(
    tenderIdParam(req),
    paramId(req.params.recordId),
    requestContext(req)
  );
  sendSuccess(res, { deleted: true }, 'Finance record deleted');
});

/** POST /api/tenders/:id/finance/documents */
export const uploadFinanceDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('Document file is required', 400);

  const result = await financeTrackingService.uploadDocument(
    tenderIdParam(req),
    requestContext(req),
    file,
    req.body?.documentType,
    req.body?.financeRecordId
  );
  sendSuccess(res, result, 'Finance document uploaded', 201);
});

/** GET /api/tenders/:id/finance/documents */
export const listFinanceDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.listDocuments(tenderIdParam(req));
  sendSuccess(res, result);
});

/** GET /api/tenders/:id/finance/documents/:documentId/download */
export const downloadFinanceDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, record } = await financeTrackingService.getDocumentFile(
    tenderIdParam(req),
    paramId(req.params.documentId)
  );
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${record.originalName}"`);
  res.send(buffer);
});

/** GET /api/tenders/:id/finance/documents/:documentId/preview */
export const previewFinanceDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, record } = await financeTrackingService.getDocumentFile(
    tenderIdParam(req),
    paramId(req.params.documentId)
  );
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Disposition', 'inline');
  res.send(buffer);
});

/** DELETE /api/tenders/:id/finance/documents/:documentId */
export const deleteFinanceDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  await financeTrackingService.deleteDocument(
    tenderIdParam(req),
    paramId(req.params.documentId),
    requestContext(req)
  );
  sendSuccess(res, { deleted: true }, 'Finance document deleted');
});

/** POST /api/tenders/:id/finance/refund-status */
export const updateFinanceRefundStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.updateRefundStatus(
    tenderIdParam(req),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Refund status updated');
});

/** GET /api/tenders/:id/finance/refund-report */
export const getFinanceRefundReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.getRefundReport(tenderIdParam(req));
  sendSuccess(res, result);
});

/** GET /api/tenders/:id/finance/alerts */
export const getFinanceAlerts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeTrackingService.getAlerts(tenderIdParam(req));
  sendSuccess(res, result);
});

/** GET /api/tenders/:id/finance/activity-log */
export const getFinanceActivityLog = asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const result = await financeTrackingService.getActivityLog(tenderIdParam(req), limit);
  sendSuccess(res, result);
});
