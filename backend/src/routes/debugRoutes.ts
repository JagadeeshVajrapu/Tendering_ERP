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
import { getDocumentParameterCandidates } from '../controllers/tenderParameterCandidateExtractionController';
import { getDocumentAiExtraction } from '../controllers/aiExtractionDebugController';
import { getDocumentServiceClassification } from '../controllers/tenderServiceClassificationController';
import { getDocumentTenderIntelligence } from '../controllers/tenderIntelligenceLayerController';
import {
  getDocumentDynamicParameterExtraction,
  postExtractSectionParameters,
} from '../controllers/enterpriseDynamicParameterExtractionController';
import { getDocumentAliasValidation } from '../controllers/enterpriseAliasValidationController';
import { getDocumentDynamicMasterDataset } from '../controllers/dynamicMasterDatasetController';
import { getDocumentAliasMapping, previewAliasMapping } from '../controllers/tenderParameterAliasMappingController';
import { getDocumentCandidateRanking } from '../controllers/tenderParameterCandidateRankingController';
import { getDocumentValidationDashboard } from '../controllers/tenderParameterValidationController';
import { getDocumentDynamicParameterDiscovery } from '../controllers/dynamicParameterDiscoveryController';
import { getDocumentRequirements } from '../controllers/requirementDiscoveryController';
import { getDocumentMasterDataset } from '../controllers/validatedMasterDatasetController';
import { getDocumentMasterDatasetDebug } from '../controllers/enterpriseMasterDatasetController';
import { getDocumentDynamicChecklist } from '../controllers/dynamicChecklistController';

const router = Router();

router.use(authenticate);

router.get('/dataset', authorize('tender:read'), getDatasetDebug);
router.post('/alias-mapping/preview', authorize('tender:read'), previewAliasMapping);
router.post('/dynamic-parameter-extraction/extract-section', authorize('tender:read'), postExtractSectionParameters);
router.get('/label-mapping-table', authorize('tender:read'), getLabelMappingTable);
router.get('/:documentId/pages', authorize('tender:read'), getDocumentPages);
router.get('/:documentId/ocr-normalization', authorize('tender:read'), getDocumentOcrNormalization);
router.get('/:documentId/fields', authorize('tender:read'), getDocumentFields);
router.get('/:documentId/parameters', authorize('tender:read'), getDiscoveredParameters);
router.get('/:documentId/dynamic-checklist', authorize('tender:read'), getDocumentDynamicChecklist);
router.get('/:documentId/master-dataset', authorize('tender:read'), getDocumentMasterDataset);
router.get('/:documentId/master-dataset-debug', authorize('tender:read'), getDocumentMasterDatasetDebug);
router.get('/:documentId/requirements', authorize('tender:read'), getDocumentRequirements);
router.get('/:documentId/alias-mapping', authorize('tender:read'), getDocumentAliasMapping);
router.get('/:documentId/service-classification', authorize('tender:read'), getDocumentServiceClassification);
router.get('/:documentId/tender-intelligence', authorize('tender:read'), getDocumentTenderIntelligence);
router.get('/:documentId/dynamic-parameter-extraction', authorize('tender:read'), getDocumentDynamicParameterExtraction);
router.get('/:documentId/alias-validation', authorize('tender:read'), getDocumentAliasValidation);
router.get('/:documentId/dynamic-master-dataset', authorize('tender:read'), getDocumentDynamicMasterDataset);
router.get('/:documentId/candidate-ranking', authorize('tender:read'), getDocumentCandidateRanking);
router.get('/:documentId/validation-dashboard', authorize('tender:read'), getDocumentValidationDashboard);
router.get('/:documentId/dynamic-parameter-discovery', authorize('tender:read'), getDocumentDynamicParameterDiscovery);
router.get('/:documentId/parameter-candidates', authorize('tender:read'), getDocumentParameterCandidates);
router.get('/:documentId/ai-extraction', authorize('tender:read'), getDocumentAiExtraction);
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

