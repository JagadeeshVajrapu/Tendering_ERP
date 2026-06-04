import { Router } from 'express';
import {
  uploadTender,
  getTenderAnalysis,
  reanalyzeTender,
  getIntelligenceJob,
  getTenderIntelligence,
  generateFeasibilityReport,
  getFeasibilityReport,
  mdTenderDecision,
  downloadFeasibilityReport,
} from '../controllers/tenderAnalysisController';
import { authenticate, authorize, authorizeRoles } from '../middleware/auth';
import { tenderAnalysisUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { uploadTenderSchema, tenderIdParamSchema, mdDecisionSchema } from '../validators';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  authorize('document:upload'),
  tenderAnalysisUpload.single('file'),
  validate(uploadTenderSchema),
  uploadTender
);

router.get(
  '/:id/analysis',
  authorize('nit:view', 'tender:read'),
  validate(tenderIdParamSchema),
  getTenderAnalysis
);

router.post(
  '/:id/reanalyze',
  authorize('document:upload', 'nit:analyze'),
  validate(tenderIdParamSchema),
  reanalyzeTender
);

router.get(
  '/:id/intelligence/job',
  authorize('nit:view', 'tender:read'),
  validate(tenderIdParamSchema),
  getIntelligenceJob
);

router.get(
  '/:id/intelligence',
  authorize('nit:view', 'tender:read'),
  validate(tenderIdParamSchema),
  getTenderIntelligence
);

router.post(
  '/:id/report',
  authorize('summary:generate'),
  validate(tenderIdParamSchema),
  generateFeasibilityReport
);

router.get(
  '/:id/report',
  authorize('summary:view', 'tender:read'),
  validate(tenderIdParamSchema),
  getFeasibilityReport
);

router.get(
  '/:id/report/download',
  authorize('summary:view', 'tender:read'),
  validate(tenderIdParamSchema),
  downloadFeasibilityReport
);

router.post(
  '/:id/decision',
  authorizeRoles(UserRole.MD),
  authorize('approval:md'),
  validate(mdDecisionSchema),
  mdTenderDecision
);

export default router;
