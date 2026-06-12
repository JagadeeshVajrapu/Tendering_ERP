import { PageText } from '../../types/intelligence';
import {
  RequirementChecklistCategory,
  RequirementChecklistItem,
  RequirementDiscoveryResult,
} from '../../types/requirementDiscovery';
import { REQUIREMENT_DISCOVERY_CATALOG } from './requirementDiscoveryCatalog';

interface OcrHit {
  mentioned: boolean;
  sourceText?: string;
  page?: number;
}

function findOcrHit(keywords: string[], pages: PageText[]): OcrHit {
  for (const page of pages) {
    const text = (page.text || '').toLowerCase();
    if (!text) continue;
    for (const kw of keywords) {
      const norm = kw.toLowerCase();
      const idx = text.indexOf(norm);
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + norm.length + 80);
        return {
          mentioned: true,
          sourceText: page.text!.slice(start, end).trim(),
          page: page.pageNumber,
        };
      }
    }
  }
  return { mentioned: false };
}

function shouldIncludeExperienceItem(
  serviceCategories: string[] | undefined,
  serviceCategory: string
): boolean {
  if (!serviceCategories?.length) return true;
  if (!serviceCategory) return false;
  return serviceCategories.some((c) => c.toLowerCase() === serviceCategory.toLowerCase());
}

export function discoverTenderRequirements(
  documentId: string,
  tenderId: string,
  serviceCategory: string,
  pages: PageText[]
): RequirementDiscoveryResult {
  const categories: RequirementChecklistCategory[] = [];

  for (const cat of REQUIREMENT_DISCOVERY_CATALOG) {
    const items: RequirementChecklistItem[] = [];

    for (const item of cat.items) {
      if (cat.id === 'experience_documents' && !shouldIncludeExperienceItem(item.serviceCategories, serviceCategory)) {
        continue;
      }

      const hit = findOcrHit(item.keywords, pages);
      const required = cat.id !== 'experience_documents' || !!item.serviceCategories?.length || hit.mentioned;

      items.push({
        id: item.id,
        name: item.name,
        categoryId: cat.id,
        categoryTitle: cat.title,
        required,
        mentionedInTender: hit.mentioned,
        source: hit.mentioned
          ? 'ocr_detected'
          : item.serviceCategories?.length
            ? 'service_category'
            : 'baseline',
        sourceText: hit.sourceText,
        page: hit.page,
      });
    }

    if (items.length) {
      categories.push({ id: cat.id, title: cat.title, items });
    }
  }

  const flat = categories.flatMap((c) => c.items);

  return {
    documentId,
    tenderId,
    serviceCategory: serviceCategory || '',
    categories,
    totalItems: flat.length,
    requiredCount: flat.filter((i) => i.required).length,
    mentionedInTenderCount: flat.filter((i) => i.mentionedInTender).length,
    discoveredAt: new Date().toISOString(),
  };
}
