import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { tenderDocumentUpload } from '../middleware/upload';
import {
  uploadTenderForExtraction,
  getTenderExtraction,
  getTenderExtractionByDocument,
} from '../controllers/tenderExtractionController';
import { getTenderDataset } from '../controllers/tenderDatasetController';
import { getTenderNitAnalysis } from '../controllers/nitAnalysisGeneratorController';
import { getTenderDiscoveredParameters } from '../controllers/tenderDiscoveredParametersController';
import { getTenderParameterMappings } from '../controllers/parameterMappingController';
import { getTenderRiskAnalysis } from '../controllers/tenderRiskAnalysisController';
import { getTenderRecommendation } from '../controllers/tenderExecutiveRecommendationController';
import { getTenderVerifiedSummary } from '../controllers/tenderVerifiedSummaryController';

const router = Router();

router.use(authenticate);

router.post('/upload', authorize('document:upload'), tenderDocumentUpload.single('file'), uploadTenderForExtraction);
router.get('/:id/dataset', authorize('tender:read'), getTenderDataset);
router.get('/:id/discovered-parameters', authorize('tender:read'), getTenderDiscoveredParameters);
router.get('/:id/parameter-mappings', authorize('tender:read'), getTenderParameterMappings);
router.get('/:id/nit-analysis', authorize('tender:read'), getTenderNitAnalysis);
router.get('/:id/risk-analysis', authorize('tender:read'), getTenderRiskAnalysis);
router.get('/:id/verified-summary', authorize('tender:read'), getTenderVerifiedSummary);
router.get('/:id/recommendation', authorize('tender:read'), getTenderRecommendation);
router.get('/:id', authorize('tender:read'), getTenderExtraction);
router.get('/:id/documents/:documentId', authorize('tender:read'), getTenderExtractionByDocument);

export default router;

