import { Router } from 'express';
import {
  createTender,
  getTenders,
  getTenderById,
  uploadDocument,
  analyzeNit,
  getNitAnalysis,
  generateSummary,
  getSummary,
  submitToMd,
  getDashboardStats,
  getMdDashboard,
  getFinanceDashboard,
  getManagerDashboard,
  getTenderWorkflow,
} from '../controllers/tenderController';
import { authenticate, authorize, authorizeRoles } from '../middleware/auth';
import { tenderDocumentUpload } from '../middleware/upload';
import { UserRole } from '../types';
import {
  getSubmissionTrackingDashboard,
  markSubmissionReady,
  lockSubmission,
  markSubmissionSubmitted,
  uploadSubmissionScreenshot,
  downloadSubmissionScreenshot,
  previewSubmissionScreenshot,
  getSubmissionTimeline,
} from '../controllers/submissionTrackingController';
import {
  getFinanceDashboard as getTenderFinanceDashboard,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  uploadFinanceDocument,
  listFinanceDocuments,
  downloadFinanceDocument,
  previewFinanceDocument,
  deleteFinanceDocument,
  updateFinanceRefundStatus,
  getFinanceRefundReport,
  getFinanceAlerts,
  getFinanceActivityLog,
} from '../controllers/financeTrackingController';
import {
  createTenderFinanceRequest,
  createTenderRefundRequest,
  createTenderRenewalRequest,
  listTenderFinanceRequests,
  createTenderFinanceTask,
  addTenderFinanceComment,
  syncTenderFinanceWorkflow,
} from '../controllers/financeWorkflowController';

const router = Router();

router.use(authenticate);

router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/md', authorizeRoles(UserRole.MD), getMdDashboard);
router.get('/dashboard/finance', authorizeRoles(UserRole.FINANCE), getFinanceDashboard);
router.get('/dashboard/manager', authorizeRoles(UserRole.MANAGER), getManagerDashboard);

router.post('/', authorize('tender:create'), createTender);
router.get('/', authorize('tender:read'), getTenders);
router.get('/:id/workflow', authorize('tender:read'), getTenderWorkflow);
router.get('/:id/submission-tracking', authorize('tender:read', 'tender:track'), getSubmissionTrackingDashboard);
router.get('/:id/submission-tracking/timeline', authorize('tender:read', 'tender:track'), getSubmissionTimeline);
router.post('/:id/submission-tracking/ready', authorize('tender:track', 'tender:update'), markSubmissionReady);
router.post('/:id/submission-tracking/lock', authorize('tender:track', 'tender:update'), lockSubmission);
router.post('/:id/submission-tracking/submit', authorize('tender:track', 'tender:update'), markSubmissionSubmitted);
router.post(
  '/:id/submission-tracking/screenshots',
  authorize('tender:track', 'tender:update'),
  tenderDocumentUpload.single('file'),
  uploadSubmissionScreenshot
);
router.get(
  '/:id/submission-tracking/screenshots/:screenshotId/download',
  authorize('tender:read', 'tender:track'),
  downloadSubmissionScreenshot
);
router.get(
  '/:id/submission-tracking/screenshots/:screenshotId/preview',
  authorize('tender:read', 'tender:track'),
  previewSubmissionScreenshot
);

const financeReadAuth = authorize('tender:read', 'finance:read', 'finance:track');
const financeWriteAuth = authorize('finance:track', 'tender:update', 'finance:update_payment');

router.get('/:id/finance', financeReadAuth, getTenderFinanceDashboard);
router.post('/:id/finance/records', financeWriteAuth, createFinanceRecord);
router.put('/:id/finance/records/:recordId', financeWriteAuth, updateFinanceRecord);
router.delete('/:id/finance/records/:recordId', financeWriteAuth, deleteFinanceRecord);
router.post(
  '/:id/finance/documents',
  financeWriteAuth,
  tenderDocumentUpload.single('file'),
  uploadFinanceDocument
);
router.get('/:id/finance/documents', financeReadAuth, listFinanceDocuments);
router.get(
  '/:id/finance/documents/:documentId/download',
  financeReadAuth,
  downloadFinanceDocument
);
router.get(
  '/:id/finance/documents/:documentId/preview',
  financeReadAuth,
  previewFinanceDocument
);
router.delete('/:id/finance/documents/:documentId', financeWriteAuth, deleteFinanceDocument);
router.post('/:id/finance/refund-status', financeWriteAuth, updateFinanceRefundStatus);
router.get('/:id/finance/refund-report', financeReadAuth, getFinanceRefundReport);
router.get('/:id/finance/alerts', financeReadAuth, getFinanceAlerts);
router.get('/:id/finance/activity-log', financeReadAuth, getFinanceActivityLog);
router.post('/:id/finance/request/create', financeWriteAuth, createTenderFinanceRequest);
router.get('/:id/finance/request/list', financeReadAuth, listTenderFinanceRequests);
router.post('/:id/finance/refund/request', financeWriteAuth, createTenderRefundRequest);
router.post('/:id/finance/renewal/request', financeWriteAuth, createTenderRenewalRequest);
router.post('/:id/finance/task/create', financeWriteAuth, createTenderFinanceTask);
router.post('/:id/finance/comment/add', financeReadAuth, addTenderFinanceComment);
router.post('/:id/finance/workflow/sync', financeReadAuth, syncTenderFinanceWorkflow);

router.get('/:id', authorize('tender:read'), getTenderById);

router.post('/:id/documents', authorize('document:upload'), tenderDocumentUpload.single('file'), uploadDocument);
router.post('/:id/analyze', authorize('nit:analyze'), analyzeNit);
router.get('/:id/nit-analysis', authorize('nit:view'), getNitAnalysis);
router.post('/:id/summary', authorize('summary:generate'), generateSummary);
router.get('/:id/summary', authorize('summary:view', 'tender:read'), getSummary);
router.post('/:id/submit-md', authorize('approval:submit_md'), submitToMd);

export default router;
