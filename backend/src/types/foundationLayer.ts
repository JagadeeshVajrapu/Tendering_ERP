import { MasterDatasetKey } from './masterDataset';
import { TenderServiceCategory } from './tenderServiceClassification';

export type ParameterValueType =
  | 'currency'
  | 'date'
  | 'period'
  | 'text'
  | 'boolean'
  | 'count'
  | 'percentage'
  | 'identifier';

export type ParameterRegistryType = 'core' | 'dynamic';

export type ValidationRuleType =
  | 'currency'
  | 'date'
  | 'period'
  | 'text'
  | 'numeric'
  | 'near_label'
  | 'forbidden_context'
  | 'quality'
  | 'dictionary_only';

export interface TenderConceptDefinition {
  id: string;
  label: string;
  keywords: string[];
  description?: string;
}

export interface TenderTerminologyEntry {
  term: string;
  meaning: string;
  aliases?: string[];
}

export interface ServiceCategoryRegistryEntry {
  category: TenderServiceCategory;
  keywords: string[];
  tenderConcepts?: string[];
  typicalDynamicParameters?: string[];
}

export interface MasterParameterRegistryEntry {
  name: string;
  canonicalKey?: MasterDatasetKey;
  type: ParameterRegistryType;
  category: string;
  valueType: ParameterValueType;
  aliases: string[];
  serviceCategories?: TenderServiceCategory[];
  examples?: string[];
  sourcePriority?: number;
}

export interface AliasRegistryEntry {
  alias: string;
  canonical: string;
  canonicalKey?: MasterDatasetKey;
}

export interface ParameterCatalogEntry extends MasterParameterRegistryEntry {
  validationRules: string[];
  nearLabels?: string[];
  forbiddenNear?: string[];
}

export interface ValidationRuleRegistryEntry {
  id: string;
  parameterKeys?: MasterDatasetKey[];
  parameterNames?: string[];
  ruleType: ValidationRuleType;
  description: string;
  nearLabels?: string[];
  forbiddenNear?: string[];
}

export interface RequirementKnowledgeEntry {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  serviceCategories?: TenderServiceCategory[];
  mandatory?: boolean;
}

export interface TenderKnowledgeBaseIndex {
  version: string;
  serviceCategories: TenderServiceCategory[];
  tenderConcepts: TenderConceptDefinition[];
  tenderTerminology: TenderTerminologyEntry[];
  coreParameterCount: number;
  dynamicParameterCount: number;
  aliasCount: number;
  validationRuleCount: number;
  requirementCount: number;
}

export interface FoundationLayerContext {
  knowledgeBase: TenderKnowledgeBaseIndex;
  serviceCategory: TenderServiceCategory | '';
  classificationConfidence: number;
  serviceContext: string;
  aliasContext: string;
  parameterCatalogContext: string;
  validationContext: string;
  requirementContext: string;
  extractionPromptAddendum: string;
}
