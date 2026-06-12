import {
  TenderServiceCategory,
  TenderServiceCategoryDefinition,
} from '../../types/tenderServiceClassification';
import { SERVICE_CATEGORY_REGISTRY } from '../../foundation/serviceCategoryRegistry';

/**
 * Service Classification Knowledge Base — re-exported from Enterprise Foundation Layer.
 * Extend categories in foundation/serviceCategoryRegistry.ts (no code changes required).
 */
export const SERVICE_CLASSIFICATION_KNOWLEDGE_BASE: TenderServiceCategoryDefinition[] =
  SERVICE_CATEGORY_REGISTRY.map((entry) => ({
    category: entry.category as TenderServiceCategory,
    keywords: entry.keywords,
    typicalDynamicParameters: entry.typicalDynamicParameters,
  }));

export const SUPPORTED_SERVICE_CATEGORIES: TenderServiceCategory[] =
  SERVICE_CLASSIFICATION_KNOWLEDGE_BASE.map((d) => d.category);

export function getServiceKeywords(category: TenderServiceCategory): string[] {
  const def = SERVICE_CLASSIFICATION_KNOWLEDGE_BASE.find((d) => d.category === category);
  return def?.keywords ?? [];
}

export function isSupportedServiceCategory(value: string): value is TenderServiceCategory {
  return SUPPORTED_SERVICE_CATEGORIES.includes(value as TenderServiceCategory);
}

export function buildServiceClassificationContext(category: TenderServiceCategory): string {
  const def = SERVICE_CLASSIFICATION_KNOWLEDGE_BASE.find((d) => d.category === category);
  const keywords = def?.keywords ?? [];
  const dynamic = def?.typicalDynamicParameters ?? [];
  return `Classified service category: ${category}.
Relevant domain keywords: ${keywords.slice(0, 12).join(', ')}.
Typical dynamic parameters: ${dynamic.slice(0, 8).join(', ') || 'service-specific fields from OCR'}.
Prioritize parameters typical for ${category} tenders when reading OCR text.`;
}
