import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { preparationPdfUpload, tenderDocumentUpload } from '../middleware/upload';
import {
  uploadTenderForExtraction,
  getTenderExtraction,
  getTenderExtractionByDocument,
} from '../controllers/tenderExtractionController';
import { getTenderDataset } from '../controllers/tenderDatasetController';
import { getTenderNitAnalysis, exportTenderNitAnalysis } from '../controllers/nitAnalysisGeneratorController';
import { getTenderDiscoveredParameters } from '../controllers/tenderDiscoveredParametersController';
import { getTenderParameterMappings } from '../controllers/parameterMappingController';
import { getTenderRiskAnalysis } from '../controllers/tenderRiskAnalysisController';
import { getTenderRecommendation } from '../controllers/tenderExecutiveRecommendationController';
import { getTenderVerifiedSummary } from '../controllers/tenderVerifiedSummaryController';
import { getTenderParameterCandidates } from '../controllers/tenderParameterCandidateExtractionController';
import { getTenderAiExtraction } from '../controllers/aiExtractionDebugController';
import { getTenderServiceClassification } from '../controllers/tenderServiceClassificationController';
import { getTenderTenderIntelligence } from '../controllers/tenderIntelligenceLayerController';
import { getTenderDynamicParameterExtraction } from '../controllers/enterpriseDynamicParameterExtractionController';
import {
  getFoundationAliasValidationEngine,
  getTenderAliasValidation,
} from '../controllers/enterpriseAliasValidationController';
import { getTenderDynamicMasterDataset } from '../controllers/dynamicMasterDatasetController';
import { getTenderRequirements } from '../controllers/requirementDiscoveryController';
import { getTenderMasterDataset as getTenderValidatedMasterDataset } from '../controllers/validatedMasterDatasetController';
import { getTenderEnterpriseMasterDataset } from '../controllers/enterpriseMasterDatasetController';
import {
  getTenderDynamicChecklist,
  updateTenderChecklistItem,
  exportTenderDynamicChecklist,
} from '../controllers/dynamicChecklistController';
import {
  listPreparationDocuments,
  uploadPreparationDocuments,
  downloadPreparationDocument,
  previewPreparationDocument,
  deletePreparationDocument,
  renamePreparationDocument,
  bulkRenamePreparationDocuments,
  mergePreparationPdfs,
  splitPreparationPdf,
  compressPreparationPdf,
  rotatePreparationPdf,
  runPreparationDocumentOcr,
  getPreparationDocumentOcr,
  getCompanyTemplateData,
  updateCompanyTemplateData,
  addPreparationHeaderFooter,
  addPreparationWatermark,
  addPreparationPageNumbers,
  autoFillPreparationTemplate,
  getPreparationValidationDashboard,
  getPreparationDocumentValidation,
  validatePreparationDocument,
  validatePreparationPackage,
  detectPreparationExpiry,
  detectPreparationBlankPages,
  detectPreparationSignature,
} from '../controllers/documentPreparationController';
import {
  unlockPreparationPdf,
  applyPreparationMarkup,
  listPreparationSigningWorkflows,
  createPreparationSigningWorkflow,
  getPreparationSigningWorkflow,
  startPreparationSigningWorkflow,
  cancelPreparationSigningWorkflow,
  applyPreparationElectronicSign,
  applyPreparationDscSign,
  verifyPreparationDsc,
  getPreparationSignatureHistory,
  getPreparationWorkflowAuditTrail,
  getPreparationAuditLogs,
} from '../controllers/documentPreparationPhase4Controller';
import {
  getFoundationKnowledgeBase,
  getFoundationParameterCatalog,
  getFoundationAliasRegistry,
  getFoundationMasterAliasRegistry,
  getFoundationValidationRules,
  getFoundationRequirements,
  getFoundationIndex,
  getFoundationTenderTypeIntelligence,
  getFoundationTenderTypeLibrary,
  getFoundationSectionDetection,
  getFoundationAliasDictionary,
  getFoundationCandidateRanking,
  getFoundationDynamicParameterFiltering,
  getFoundationAiVerificationMasterDataset,
  getFoundationChecklistCatalog,
} from '../controllers/foundationLayerController';
import { getFoundationRankingRules } from '../controllers/tenderParameterCandidateRankingController';
import { getFoundationValidationEngine } from '../controllers/tenderParameterValidationController';
import { getFoundationDynamicParameterRegistry } from '../controllers/dynamicParameterDiscoveryController';

const router = Router();

router.use(authenticate);

router.get('/foundation', authorize('tender:read'), getFoundationKnowledgeBase);
router.get('/foundation/index', authorize('tender:read'), getFoundationIndex);
router.get('/foundation/catalog', authorize('tender:read'), getFoundationParameterCatalog);
router.get('/foundation/aliases', authorize('tender:read'), getFoundationAliasRegistry);
router.get('/foundation/master-aliases', authorize('tender:read'), getFoundationMasterAliasRegistry);
router.get('/foundation/ranking-rules', authorize('tender:read'), getFoundationRankingRules);
router.get('/foundation/validation-engine', authorize('tender:read'), getFoundationValidationEngine);
router.get('/foundation/alias-validation-engine', authorize('tender:read'), getFoundationAliasValidationEngine);
router.get('/foundation/dynamic-parameter-registry', authorize('tender:read'), getFoundationDynamicParameterRegistry);
router.get('/foundation/validation-rules', authorize('tender:read'), getFoundationValidationRules);
router.get('/foundation/requirements', authorize('tender:read'), getFoundationRequirements);
router.get('/foundation/tender-type-intelligence', authorize('tender:read'), getFoundationTenderTypeIntelligence);
router.get('/foundation/tender-type-library', authorize('tender:read'), getFoundationTenderTypeLibrary);
router.get('/foundation/section-detection', authorize('tender:read'), getFoundationSectionDetection);
router.get('/foundation/alias-dictionary', authorize('tender:read'), getFoundationAliasDictionary);
router.get('/foundation/candidate-ranking', authorize('tender:read'), getFoundationCandidateRanking);
router.get('/foundation/dynamic-parameter-filtering', authorize('tender:read'), getFoundationDynamicParameterFiltering);
router.get('/foundation/ai-verification-master-dataset', authorize('tender:read'), getFoundationAiVerificationMasterDataset);
router.get('/foundation/checklist-catalog', authorize('tender:read'), getFoundationChecklistCatalog);

router.post('/upload', authorize('document:upload'), tenderDocumentUpload.single('file'), uploadTenderForExtraction);
router.get('/:id/dataset', authorize('tender:read'), getTenderDataset);
router.get('/:id/discovered-parameters', authorize('tender:read'), getTenderDiscoveredParameters);
router.get('/:id/service-classification', authorize('tender:read'), getTenderServiceClassification);
router.get('/:id/tender-intelligence', authorize('tender:read'), getTenderTenderIntelligence);
router.get('/:id/dynamic-parameter-extraction', authorize('tender:read'), getTenderDynamicParameterExtraction);
router.get('/:id/alias-validation', authorize('tender:read'), getTenderAliasValidation);
router.get('/:id/dynamic-master-dataset', authorize('tender:read'), getTenderDynamicMasterDataset);
router.get('/:id/parameter-candidates', authorize('tender:read'), getTenderParameterCandidates);
router.get('/:id/ai-extraction', authorize('tender:read'), getTenderAiExtraction);
router.get('/:id/requirements', authorize('tender:read'), getTenderRequirements);
router.get('/:id/validated-master-dataset', authorize('tender:read'), getTenderValidatedMasterDataset);
router.get('/:id/master-dataset', authorize('tender:read'), getTenderEnterpriseMasterDataset);
router.get('/:id/dynamic-checklist', authorize('tender:read'), getTenderDynamicChecklist);
router.get('/:id/dynamic-checklist/export', authorize('tender:read'), exportTenderDynamicChecklist);
router.patch('/:id/dynamic-checklist/items/:itemId', authorize('tender:update'), updateTenderChecklistItem);
router.get('/:id/document-preparation/documents', authorize('tender:read'), listPreparationDocuments);
router.post(
  '/:id/document-preparation/documents',
  authorize('document:upload'),
  preparationPdfUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: 20 },
  ]),
  uploadPreparationDocuments
);
router.get(
  '/:id/document-preparation/documents/:docId/download',
  authorize('tender:read'),
  downloadPreparationDocument
);
router.get(
  '/:id/document-preparation/documents/:docId/preview',
  authorize('tender:read'),
  previewPreparationDocument
);
const documentPrepareAuth = authorize('tender:update', 'document:upload', 'compliance:upload');
const documentWorkflowAuth = authorize('document:workflow', 'tender:update');
const documentSignAuth = authorize('document:sign', 'tender:update');

router.delete('/:id/document-preparation/documents/:docId', documentPrepareAuth, deletePreparationDocument);
router.patch(
  '/:id/document-preparation/documents/bulk-rename',
  documentPrepareAuth,
  bulkRenamePreparationDocuments
);
router.patch(
  '/:id/document-preparation/documents/:docId/rename',
  documentPrepareAuth,
  renamePreparationDocument
);
router.get('/:id/document-preparation/template-data', authorize('tender:read'), getCompanyTemplateData);
router.put('/:id/document-preparation/template-data', documentPrepareAuth, updateCompanyTemplateData);
router.get(
  '/:id/document-preparation/documents/:docId/ocr',
  authorize('tender:read'),
  getPreparationDocumentOcr
);
router.post(
  '/:id/document-preparation/documents/:docId/ocr',
  documentPrepareAuth,
  runPreparationDocumentOcr
);
router.post('/:id/document-preparation/pdf/merge', documentPrepareAuth, mergePreparationPdfs);
router.post('/:id/document-preparation/pdf/split', documentPrepareAuth, splitPreparationPdf);
router.post('/:id/document-preparation/pdf/compress', documentPrepareAuth, compressPreparationPdf);
router.post('/:id/document-preparation/pdf/rotate', documentPrepareAuth, rotatePreparationPdf);
router.post('/:id/document-preparation/pdf/header-footer', documentPrepareAuth, addPreparationHeaderFooter);
router.post('/:id/document-preparation/pdf/watermark', documentPrepareAuth, addPreparationWatermark);
router.post('/:id/document-preparation/pdf/page-numbers', documentPrepareAuth, addPreparationPageNumbers);
router.post('/:id/document-preparation/pdf/auto-fill', documentPrepareAuth, autoFillPreparationTemplate);
router.get(
  '/:id/document-preparation/validation/dashboard',
  authorize('tender:read'),
  getPreparationValidationDashboard
);
router.post(
  '/:id/document-preparation/validation/package',
  documentPrepareAuth,
  validatePreparationPackage
);
router.get(
  '/:id/document-preparation/documents/:docId/validation',
  authorize('tender:read'),
  getPreparationDocumentValidation
);
router.post(
  '/:id/document-preparation/documents/:docId/validate',
  documentPrepareAuth,
  validatePreparationDocument
);
router.post(
  '/:id/document-preparation/documents/:docId/validation/detect-expiry',
  documentPrepareAuth,
  detectPreparationExpiry
);
router.post(
  '/:id/document-preparation/documents/:docId/validation/detect-blank-pages',
  documentPrepareAuth,
  detectPreparationBlankPages
);
router.post(
  '/:id/document-preparation/documents/:docId/validation/detect-signature',
  documentPrepareAuth,
  detectPreparationSignature
);
router.post('/:id/document-preparation/pdf/unlock', documentPrepareAuth, unlockPreparationPdf);
router.post('/:id/document-preparation/pdf/markup', documentPrepareAuth, applyPreparationMarkup);
router.get(
  '/:id/document-preparation/signing/workflows',
  authorize('tender:read'),
  listPreparationSigningWorkflows
);
router.post(
  '/:id/document-preparation/signing/workflows',
  documentWorkflowAuth,
  createPreparationSigningWorkflow
);
router.get(
  '/:id/document-preparation/signing/workflows/:workflowId',
  authorize('tender:read'),
  getPreparationSigningWorkflow
);
router.post(
  '/:id/document-preparation/signing/workflows/:workflowId/start',
  documentWorkflowAuth,
  startPreparationSigningWorkflow
);
router.post(
  '/:id/document-preparation/signing/workflows/:workflowId/cancel',
  documentWorkflowAuth,
  cancelPreparationSigningWorkflow
);
router.post(
  '/:id/document-preparation/signing/workflows/:workflowId/esign',
  documentSignAuth,
  applyPreparationElectronicSign
);
router.post(
  '/:id/document-preparation/signing/workflows/:workflowId/dsc-sign',
  documentSignAuth,
  applyPreparationDscSign
);
router.post(
  '/:id/document-preparation/signing/documents/:docId/verify-dsc',
  documentSignAuth,
  verifyPreparationDsc
);
router.get(
  '/:id/document-preparation/signing/documents/:docId/history',
  authorize('tender:read'),
  getPreparationSignatureHistory
);
router.get(
  '/:id/document-preparation/signing/workflows/:workflowId/audit-trail',
  authorize('tender:read'),
  getPreparationWorkflowAuditTrail
);
router.get(
  '/:id/document-preparation/audit-logs',
  authorize('tender:read'),
  getPreparationAuditLogs
);
router.get('/:id/parameter-mappings', authorize('tender:read'), getTenderParameterMappings);
router.get('/:id/nit-analysis', authorize('tender:read'), getTenderNitAnalysis);
router.get('/:id/nit-analysis/export', authorize('tender:read'), exportTenderNitAnalysis);
router.get('/:id/risk-analysis', authorize('tender:read'), getTenderRiskAnalysis);
router.get('/:id/verified-summary', authorize('tender:read'), getTenderVerifiedSummary);
router.get('/:id/recommendation', authorize('tender:read'), getTenderRecommendation);
router.get('/:id', authorize('tender:read'), getTenderExtraction);
router.get('/:id/documents/:documentId', authorize('tender:read'), getTenderExtractionByDocument);

export default router;

