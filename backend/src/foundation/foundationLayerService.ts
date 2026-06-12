import { PageText } from '../types/intelligence';
import { FoundationLayerContext } from '../types/foundationLayer';
import { TenderServiceCategory } from '../types/tenderServiceClassification';
import { getTenderKnowledgeBaseIndex } from './tenderKnowledgeBase';
import { SERVICE_CATEGORY_REGISTRY, getServiceCategoryEntry } from './serviceCategoryRegistry';
import { getDynamicParameters } from './masterParameterRegistry';
import { formatAliasRegistryForPrompt } from './aliasRegistry';
import { formatParameterCatalogForPrompt } from './parameterCatalog';
import { formatValidationRulesForPrompt } from './validationRuleRegistry';
import { formatRequirementKnowledgeForPrompt } from './requirementKnowledgeBase';
import { classifyTenderServiceFromText } from '../services/tenderClassification/tenderServiceClassificationEngine';

/**
 * Enterprise Tender Intelligence Foundation Layer.
 * Builds extraction context from centralized knowledge base before AI extraction.
 */
class FoundationLayerService {
  classifyFromPages(pages: PageText[]): {
    serviceCategory: TenderServiceCategory | '';
    classificationConfidence: number;
  } {
    const text = pages.map((p) => p.text).join('\n');
    const result = classifyTenderServiceFromText(text);
    return {
      serviceCategory: (result.serviceCategory as TenderServiceCategory) || '',
      classificationConfidence: result.confidence,
    };
  }

  buildFoundationContext(opts?: {
    serviceCategory?: TenderServiceCategory | '';
    classificationConfidence?: number;
    pages?: PageText[];
  }): FoundationLayerContext {
    let serviceCategory = opts?.serviceCategory ?? '';
    let classificationConfidence = opts?.classificationConfidence ?? 0;

    if (!serviceCategory && opts?.pages?.length) {
      const classified = this.classifyFromPages(opts.pages);
      serviceCategory = classified.serviceCategory;
      classificationConfidence = classified.classificationConfidence;
    }

    const knowledgeBase = getTenderKnowledgeBaseIndex();
    const categoryEntry = serviceCategory ? getServiceCategoryEntry(serviceCategory) : undefined;

    const serviceContext = serviceCategory
      ? `FOUNDATION SERVICE CLASSIFICATION:
Category: ${serviceCategory}
Confidence: ${classificationConfidence}%
Domain keywords: ${categoryEntry?.keywords.slice(0, 15).join(', ') || 'general'}
Typical dynamic parameters for this category: ${
          categoryEntry?.typicalDynamicParameters?.join(', ') ||
          getDynamicParameters(serviceCategory)
            .map((p) => p.name)
            .slice(0, 10)
            .join(', ')
        }`
      : '';

    const aliasContext = `FOUNDATION ALIAS REGISTRY (normalize OCR labels):\n${formatAliasRegistryForPrompt(30)}`;

    const parameterCatalogContext = `FOUNDATION PARAMETER CATALOG:\n${formatParameterCatalogForPrompt(serviceCategory || undefined)}`;

    const validationContext = `FOUNDATION VALIDATION RULES:\n${formatValidationRulesForPrompt()}`;

    const requirementContext = `FOUNDATION REQUIREMENT KNOWLEDGE:\n${formatRequirementKnowledgeForPrompt()}`;

    const extractionPromptAddendum = [
      serviceContext,
      parameterCatalogContext,
      aliasContext,
      validationContext,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      knowledgeBase,
      serviceCategory,
      classificationConfidence,
      serviceContext,
      aliasContext,
      parameterCatalogContext,
      validationContext,
      requirementContext,
      extractionPromptAddendum,
    };
  }

  getKnowledgeBaseSummary() {
    return {
      ...getTenderKnowledgeBaseIndex(),
      serviceCategoryRegistry: SERVICE_CATEGORY_REGISTRY.map((e) => ({
        category: e.category,
        keywordCount: e.keywords.length,
        typicalDynamicParameters: e.typicalDynamicParameters ?? [],
      })),
    };
  }
}

export const foundationLayerService = new FoundationLayerService();
