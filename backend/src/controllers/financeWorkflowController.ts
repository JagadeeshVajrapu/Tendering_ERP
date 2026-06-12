import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { financeWorkflowService } from '../services/financeWorkflow/financeWorkflowService';
import { FinanceWorkflowListQuery } from '../types/financeWorkflow';

function requestContext(req: AuthRequest) {
  return {
    userId: req.user!._id,
    userRole: req.user!.role,
    userName: req.user!.name,
    ipAddress: req.ip,
  };
}

function listQuery(req: AuthRequest): FinanceWorkflowListQuery {
  return {
    page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
    limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    status: req.query.status
      ? (String(req.query.status) as FinanceWorkflowListQuery['status'])
      : undefined,
    requestType: req.query.requestType
      ? (String(req.query.requestType) as FinanceWorkflowListQuery['requestType'])
      : undefined,
    tenderId: req.query.tenderId ? String(req.query.tenderId) : undefined,
    sortBy: req.query.sortBy
      ? (String(req.query.sortBy) as FinanceWorkflowListQuery['sortBy'])
      : undefined,
    sortOrder: req.query.sortOrder ? (String(req.query.sortOrder) as 'asc' | 'desc') : undefined,
  };
}

/** GET /api/finance/dashboard */
export const getFinanceApprovalDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.getApprovalDashboard(requestContext(req));
  sendSuccess(res, result);
});

/** GET /api/finance/request/list */
export const listFinanceWorkflowRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.listRequests(listQuery(req), requestContext(req));
  sendSuccess(res, result);
});

/** POST /api/finance/request/approve/:requestId */
export const approveFinanceWorkflowRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.approveRequest(
    paramId(req.params.requestId),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Request approved');
});

/** POST /api/finance/request/reject/:requestId */
export const rejectFinanceWorkflowRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.rejectRequest(
    paramId(req.params.requestId),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Request rejected');
});

/** GET /api/finance/refund/list */
export const listFinanceRefundRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.listRequests(
    { ...listQuery(req), requestType: undefined, status: req.query.status as FinanceWorkflowListQuery['status'] },
    requestContext(req)
  );
  const refunds = result.items.filter((r) =>
    ['REFUND_EMD', 'REFUND_SECURITY_DEPOSIT', 'PBG_RELEASE'].includes(r.requestType)
  );
  sendSuccess(res, { ...result, items: refunds });
});

/** GET /api/finance/task/list */
export const listFinanceTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.listTasks({
    tenderId: req.query.tenderId ? String(req.query.tenderId) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    assignedTo: req.query.assignedTo ? String(req.query.assignedTo) : undefined,
  });
  sendSuccess(res, result);
});

/** PATCH /api/finance/task/:taskId/status */
export const updateFinanceTaskStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.updateTaskStatus(
    paramId(req.params.taskId),
    req.body.status,
    requestContext(req)
  );
  sendSuccess(res, result, 'Task updated');
});

/** GET /api/finance/notifications */
export const getFinanceWorkflowNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
  const result = await financeWorkflowService.getNotifications(String(req.user!._id), limit);
  sendSuccess(res, result);
});

/** GET /api/finance/audit-logs */
export const getFinanceWorkflowAuditLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.getAuditLogs({
    tenderId: req.query.tenderId ? String(req.query.tenderId) : undefined,
    limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 50,
  });
  sendSuccess(res, result);
});

/** GET /api/finance/request/:requestId/comments */
export const getFinanceRequestComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.getComments(paramId(req.params.requestId));
  sendSuccess(res, result);
});

/** GET /api/finance/request/:requestId/approvals */
export const getFinanceRequestApprovals = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.getApprovals(paramId(req.params.requestId));
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/finance/request/create */
export const createTenderFinanceRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.createRequest(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Finance request created', 201);
});

/** POST /api/tenders/:id/finance/refund/request */
export const createTenderRefundRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.createRefundRequest(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Refund request created', 201);
});

/** POST /api/tenders/:id/finance/renewal/request */
export const createTenderRenewalRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.createRenewalRequest(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Renewal request created', 201);
});

/** GET /api/tenders/:id/finance/request/list */
export const listTenderFinanceRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.listRequests(
    { ...listQuery(req), tenderId: paramId(req.params.id) },
    requestContext(req)
  );
  sendSuccess(res, result);
});

/** POST /api/tenders/:id/finance/task/create */
export const createTenderFinanceTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.createTask(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Finance task created', 201);
});

/** POST /api/tenders/:id/finance/comment/add */
export const addTenderFinanceComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await financeWorkflowService.addComment(
    paramId(req.params.id),
    requestContext(req),
    req.body
  );
  sendSuccess(res, result, 'Comment added', 201);
});

/** POST /api/tenders/:id/finance/workflow/sync */
export const syncTenderFinanceWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const ctx = requestContext(req);
  await financeWorkflowService.processExpiryRenewals(tenderId, ctx);
  await financeWorkflowService.syncOperationalTasks(tenderId, ctx);
  sendSuccess(res, { synced: true }, 'Finance workflow synced');
});
