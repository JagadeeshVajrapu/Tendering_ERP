import { TenderKnowledgeBaseIndex } from '../types/foundationLayer';
import { SERVICE_CATEGORY_REGISTRY, TENDER_CONCEPTS, TENDER_TERMINOLOGY } from './serviceCategoryRegistry';
import { CORE_PARAMETER_REGISTRY, DYNAMIC_PARAMETER_REGISTRY } from './masterParameterRegistry';
import { ALIAS_REGISTRY } from './aliasRegistry';
import { PARAMETER_CATALOG } from './parameterCatalog';
import { VALIDATION_RULE_REGISTRY } from './validationRuleRegistry';
import { REQUIREMENT_KNOWLEDGE_BASE } from './requirementKnowledgeBase';

export const FOUNDATION_LAYER_VERSION = '1.0.0';

/**
 * Part 1 — Centralized Tender Knowledge Base index.
 * Single source of truth for all foundation registries.
 */
export function getTenderKnowledgeBaseIndex(): TenderKnowledgeBaseIndex {
  return {
    version: FOUNDATION_LAYER_VERSION,
    serviceCategories: SERVICE_CATEGORY_REGISTRY.map((e) => e.category),
    tenderConcepts: TENDER_CONCEPTS,
    tenderTerminology: TENDER_TERMINOLOGY,
    coreParameterCount: CORE_PARAMETER_REGISTRY.length,
    dynamicParameterCount: DYNAMIC_PARAMETER_REGISTRY.length,
    aliasCount: ALIAS_REGISTRY.length,
    validationRuleCount: VALIDATION_RULE_REGISTRY.length,
    requirementCount: REQUIREMENT_KNOWLEDGE_BASE.length,
  };
}

export {
  SERVICE_CATEGORY_REGISTRY,
  TENDER_CONCEPTS,
  TENDER_TERMINOLOGY,
  CORE_PARAMETER_REGISTRY,
  DYNAMIC_PARAMETER_REGISTRY,
  ALIAS_REGISTRY,
  PARAMETER_CATALOG,
  VALIDATION_RULE_REGISTRY,
  REQUIREMENT_KNOWLEDGE_BASE,
};
