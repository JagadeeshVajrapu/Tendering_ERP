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

const router = Router();

router.use(authenticate);

router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/md', authorizeRoles(UserRole.MD), getMdDashboard);
router.get('/dashboard/finance', authorizeRoles(UserRole.FINANCE), getFinanceDashboard);
router.get('/dashboard/manager', authorizeRoles(UserRole.MANAGER), getManagerDashboard);

router.post('/', authorize('tender:create'), createTender);
router.get('/', authorize('tender:read'), getTenders);
router.get('/:id/workflow', authorize('tender:read'), getTenderWorkflow);
router.get('/:id', authorize('tender:read'), getTenderById);

router.post('/:id/documents', authorize('document:upload'), tenderDocumentUpload.single('file'), uploadDocument);
router.post('/:id/analyze', authorize('nit:analyze'), analyzeNit);
router.get('/:id/nit-analysis', authorize('nit:view'), getNitAnalysis);
router.post('/:id/summary', authorize('summary:generate'), generateSummary);
router.get('/:id/summary', authorize('summary:view', 'tender:read'), getSummary);
router.post('/:id/submit-md', authorize('approval:submit_md'), submitToMd);

export default router;
