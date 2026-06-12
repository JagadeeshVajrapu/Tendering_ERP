import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { postAwardService } from '../services/postAward/postAwardService';
import { PostAwardSearchQuery } from '../types/postAward';

function requestContext(req: AuthRequest) {
  return {
    userId: req.user!._id,
    userRole: req.user!.role,
    userName: req.user!.name,
    ipAddress: req.ip,
  };
}

function searchQuery(req: AuthRequest): PostAwardSearchQuery {
  return {
    q: req.query.q ? String(req.query.q) : undefined,
    match: req.query.match === 'exact' ? 'exact' : 'partial',
    status: req.query.status as PostAwardSearchQuery['status'],
    clientName: req.query.clientName ? String(req.query.clientName) : undefined,
    expiringWithinDays: req.query.expiringWithinDays
      ? parseInt(String(req.query.expiringWithinDays), 10)
      : undefined,
    page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
    limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
    sortBy: req.query.sortBy as PostAwardSearchQuery['sortBy'],
    sortOrder: req.query.sortOrder as 'asc' | 'desc',
  };
}

/** GET /api/post-award/dashboard */
export const getPostAwardDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.getDashboard(searchQuery(req));
  sendSuccess(res, result);
});

/** GET /api/post-award/contracts/search */
export const searchPostAwardContracts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.getDashboard(searchQuery(req));
  sendSuccess(res, result.contracts);
});

/** GET /api/tenders/:id/post-award */
export const getTenderPostAward = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const available = await postAwardService.isPostAwardAvailable(tenderId);
  if (!available) {
    sendSuccess(res, { available: false, contract: null });
    return;
  }
  const contract = await postAwardService.getContractByTender(tenderId);
  sendSuccess(res, { available: true, contract });
});

/** POST /api/tenders/:id/post-award/award */
export const markTenderAwarded = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.markTenderAwarded(paramId(req.params.id), requestContext(req));
  sendSuccess(res, result, 'Tender marked as awarded');
});

/** PUT /api/tenders/:id/post-award/contract */
export const updatePostAwardContract = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.updateContract(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Contract updated');
});

/** POST /api/tenders/:id/post-award/revenue */
export const addPostAwardRevenue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.addRevenue(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Revenue entry added', 201);
});

/** POST /api/tenders/:id/post-award/revenue/:revenueId/approve */
export const approvePostAwardRevenue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.approveRevenue(
    paramId(req.params.revenueId),
    requestContext(req),
    req.body.approved !== false
  );
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/post-award/revenue/:revenueId/receive */
export const receivePostAwardRevenue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.recordRevenueReceived(
    paramId(req.params.revenueId),
    requestContext(req),
    Number(req.body.receivedAmount)
  );
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/post-award/billing */
export const addPostAwardBilling = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.addBilling(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Billing record added', 201);
});

/** POST /api/tenders/:id/post-award/billing/:billingId/approve */
export const approvePostAwardBilling = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await postAwardService.approveBilling(
    paramId(req.params.billingId),
    requestContext(req),
    req.body.approved !== false
  );
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/post-award/documents */
export const uploadPostAwardDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('Document file is required', 400);
  const result = await postAwardService.uploadDocument(
    paramId(req.params.id),
    requestContext(req),
    file,
    req.body?.documentType,
    req.body?.documentNumber
  );
  sendSuccess(res, result, 'Document uploaded', 201);
});

/** GET /api/tenders/:id/post-award/documents/:documentId/download */
export const downloadPostAwardDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, record } = await postAwardService.getDocumentFile(
    paramId(req.params.id),
    paramId(req.params.documentId)
  );
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${record.originalName}"`);
  res.send(buffer);
});

/** DELETE /api/tenders/:id/post-award/:type/:recordId */
export const deletePostAwardRecord = asyncHandler(async (req: AuthRequest, res: Response) => {
  const type = req.params.type as 'revenue' | 'billing' | 'document';
  const result = await postAwardService.deleteRecord(
    paramId(req.params.id),
    requestContext(req),
    type,
    paramId(req.params.recordId)
  );
  sendSuccess(res, result, 'Record deleted');
});

/** POST /api/post-award/alerts/sync */
export const syncPostAwardAlerts = asyncHandler(async (_req: AuthRequest, res: Response) => {
  await postAwardService.syncAlerts();
  sendSuccess(res, { synced: true });
});

/** GET /api/post-award/availability/:tenderId */
export const checkPostAwardAvailability = asyncHandler(async (req: AuthRequest, res: Response) => {
  const available = await postAwardService.isPostAwardAvailable(paramId(req.params.tenderId));
  sendSuccess(res, { available });
});
