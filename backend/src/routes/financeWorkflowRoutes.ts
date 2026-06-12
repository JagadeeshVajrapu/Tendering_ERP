import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getFinanceApprovalDashboard,
  listFinanceWorkflowRequests,
  approveFinanceWorkflowRequest,
  rejectFinanceWorkflowRequest,
  listFinanceRefundRequests,
  listFinanceTasks,
  updateFinanceTaskStatus,
  getFinanceWorkflowNotifications,
  getFinanceWorkflowAuditLogs,
  getFinanceRequestComments,
  getFinanceRequestApprovals,
} from '../controllers/financeWorkflowController';

const router = Router();

router.use(authenticate);

const financeTeamAuth = authorize(
  'finance:read',
  'finance:approve',
  'finance:track',
  'tender:read'
);
const approveAuth = authorize('finance:approve', 'compliance:approve');

router.get('/dashboard', financeTeamAuth, getFinanceApprovalDashboard);
router.get('/request/list', financeTeamAuth, listFinanceWorkflowRequests);
router.post('/request/approve/:requestId', approveAuth, approveFinanceWorkflowRequest);
router.post('/request/reject/:requestId', approveAuth, rejectFinanceWorkflowRequest);
router.get('/refund/list', financeTeamAuth, listFinanceRefundRequests);
router.get('/task/list', financeTeamAuth, listFinanceTasks);
router.patch('/task/:taskId/status', financeTeamAuth, updateFinanceTaskStatus);
router.get('/notifications', financeTeamAuth, getFinanceWorkflowNotifications);
router.get('/audit-logs', financeTeamAuth, getFinanceWorkflowAuditLogs);
router.get('/request/:requestId/comments', financeTeamAuth, getFinanceRequestComments);
router.get('/request/:requestId/approvals', financeTeamAuth, getFinanceRequestApprovals);

export default router;
