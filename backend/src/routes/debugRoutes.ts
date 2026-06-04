import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getDocumentDebug, getDocumentOcr, getDocumentRulesDebug, getDocumentCandidates, getDocumentValidation, getDocumentOpenAi, getDocumentConfidence } from '../controllers/debugController';
import { getDocumentPages } from '../controllers/ocrDebugController';
import { getDocumentOcrNormalization } from '../controllers/ocrNormalizationController';
import { getDocumentFields } from '../controllers/fieldLocatorController';
import { getDiscoveredParameters } from '../controllers/parameterDiscoveryController';
import { getDocumentParameterMappings } from '../controllers/parameterMappingController';
import { getLabelValuePairs } from '../controllers/labelValueController';
import { getLabelValueMappings, getLabelMappingTable } from '../controllers/labelValueMappingController';
import { getDatasetDebug } from '../controllers/datasetDebugController';
import { getDocumentDataset } from '../controllers/tenderDatasetController';
import { getDocumentRisksDebug } from '../controllers/debugRisksController';

const router = Router();

router.use(authenticate);

router.get('/dataset', authorize('tender:read'), getDatasetDebug);
router.get('/label-mapping-table', authorize('tender:read'), getLabelMappingTable);
router.get('/:documentId/pages', authorize('tender:read'), getDocumentPages);
router.get('/:documentId/ocr-normalization', authorize('tender:read'), getDocumentOcrNormalization);
router.get('/:documentId/fields', authorize('tender:read'), getDocumentFields);
router.get('/:documentId/parameters', authorize('tender:read'), getDiscoveredParameters);
router.get('/:documentId/parameter-mappings', authorize('tender:read'), getDocumentParameterMappings);
router.get('/:documentId/label-values', authorize('tender:read'), getLabelValuePairs);
router.get('/:documentId/label-mappings', authorize('tender:read'), getLabelValueMappings);
router.get('/:documentId/dataset', authorize('tender:read'), getDocumentDataset);
router.get('/:documentId/confidence', authorize('tender:read'), getDocumentConfidence);
router.get('/:documentId/openai', authorize('tender:read'), getDocumentOpenAi);
router.get('/:documentId/validation', authorize('tender:read'), getDocumentValidation);
router.get('/:documentId/candidates', authorize('tender:read'), getDocumentCandidates);
router.get('/:documentId/ocr', authorize('tender:read'), getDocumentOcr);
router.get('/:documentId/rules', authorize('tender:read'), getDocumentRulesDebug);
router.get('/:documentId/risks', authorize('tender:read'), getDocumentRisksDebug);
router.get('/:documentId', authorize('tender:read'), getDocumentDebug);

export default router;

