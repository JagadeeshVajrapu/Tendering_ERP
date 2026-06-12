import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { foundationLayerService } from '../foundation/foundationLayerService';
import { getTenderKnowledgeBaseIndex } from '../foundation/tenderKnowledgeBase';
import { PARAMETER_CATALOG } from '../foundation/parameterCatalog';
import { ALIAS_REGISTRY } from '../foundation/aliasRegistry';
import { VALIDATION_RULE_REGISTRY } from '../foundation/validationRuleRegistry';
import { REQUIREMENT_KNOWLEDGE_BASE } from '../foundation/requirementKnowledgeBase';
import { getEnterpriseCandidateRankingDuplicateSummary } from '../services/tenderParameter/enterpriseCandidateRankingDuplicateEngine';
import { getEnterpriseAliasDictionarySummary } from '../services/tenderParameter/enterpriseAliasDictionaryEngine';
import { getEnterpriseDynamicParameterFilteringSummary } from '../services/tenderParameter/enterpriseDynamicParameterFilteringEngine';
import { getEnterpriseAiVerificationMasterDatasetSummary } from '../services/masterTenderDataset/enterpriseAiVerificationMasterDatasetEngine';
import { getMasterAliasRegistrySummary } from '../services/tenderParameter/enterpriseTenderAliasEngine';
import { tenderTypeIntelligenceService } from '../services/tenderIntelligence/tenderTypeIntelligenceService';
import { enterpriseSectionDetectionService } from '../services/tenderIntelligence/enterpriseSectionDetectionService';
import { getEnterpriseTenderTypeLibrarySummary } from '../services/tenderIntelligence/enterpriseTenderTypeLibraryEngine';
import {
  DYNAMIC_CHECKLIST_CATALOG,
  DYNAMIC_CHECKLIST_CATEGORY_ORDER,
} from '../services/dynamicChecklist/dynamicChecklistCatalog';
import { EXPERIENCE_CATEGORIES } from '../services/dynamicChecklist/checklistExperienceYearEngine';
import { generateFinancialYears, getCurrentFinancialYearStart } from '../services/dynamicChecklist/checklistFinancialYearUtils';

/** GET /api/tender/foundation — Enterprise foundation layer knowledge base index */
export const getFoundationKnowledgeBase = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, foundationLayerService.getKnowledgeBaseSummary());
});

/** GET /api/tender/foundation/catalog — Full parameter catalog */
export const getFoundationParameterCatalog = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, { parameters: PARAMETER_CATALOG, count: PARAMETER_CATALOG.length });
});

/** GET /api/tender/foundation/aliases — Flat alias registry */
export const getFoundationAliasRegistry = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, { aliases: ALIAS_REGISTRY, count: ALIAS_REGISTRY.length });
});

/** GET /api/tender/foundation/master-aliases — Enterprise master alias registry */
export const getFoundationMasterAliasRegistry = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getMasterAliasRegistrySummary());
});

/** GET /api/tender/foundation/validation-rules — Validation rule registry */
export const getFoundationValidationRules = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, { rules: VALIDATION_RULE_REGISTRY, count: VALIDATION_RULE_REGISTRY.length });
});

/** GET /api/tender/foundation/requirements — Requirement knowledge base */
export const getFoundationRequirements = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, { requirements: REQUIREMENT_KNOWLEDGE_BASE, count: REQUIREMENT_KNOWLEDGE_BASE.length });
});

/** GET /api/tender/foundation/index — Lightweight index */
export const getFoundationIndex = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getTenderKnowledgeBaseIndex());
});

/** GET /api/tender/foundation/tender-type-intelligence — Tender-type profiles (parameters, rules, aliases) */
export const getFoundationTenderTypeIntelligence = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, {
    ...tenderTypeIntelligenceService.getRuleSummary(),
    ...getEnterpriseTenderTypeLibrarySummary(),
  });
});

/** GET /api/tender/foundation/tender-type-library — Enterprise tender-type parameter libraries */
export const getFoundationTenderTypeLibrary = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getEnterpriseTenderTypeLibrarySummary());
});

/** GET /api/tender/foundation/section-detection — Enterprise section detection rules */
export const getFoundationSectionDetection = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, enterpriseSectionDetectionService.getRuleSummary());
});

/** GET /api/tender/foundation/alias-dictionary — Enterprise alias dictionary (normalize + dedupe) */
export const getFoundationAliasDictionary = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getEnterpriseAliasDictionarySummary());
});

/** GET /api/tender/foundation/candidate-ranking — Enterprise ranking & duplicate removal engine */
export const getFoundationCandidateRanking = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getEnterpriseCandidateRankingDuplicateSummary());
});

/** GET /api/tender/foundation/dynamic-parameter-filtering — Enterprise dynamic parameter noise filter */
export const getFoundationDynamicParameterFiltering = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getEnterpriseDynamicParameterFilteringSummary());
});

/** GET /api/tender/foundation/ai-verification-master-dataset — Final AI verification before master dataset storage */
export const getFoundationAiVerificationMasterDataset = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getEnterpriseAiVerificationMasterDatasetSummary());
});

/** GET /api/tender/foundation/checklist-catalog — Configurable checklist structure for admin panel */
export const getFoundationChecklistCatalog = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, {
    schemaVersion: 2,
    categoryOrder: DYNAMIC_CHECKLIST_CATEGORY_ORDER,
    categories: DYNAMIC_CHECKLIST_CATALOG,
    experienceCategories: EXPERIENCE_CATEGORIES,
    financialYears: generateFinancialYears(2001),
    currentFinancialYearStart: getCurrentFinancialYearStart(),
    configurable: true,
    note: 'Catalog is code-defined today; admin write APIs can extend this registry without app redeploy.',
  });
});
