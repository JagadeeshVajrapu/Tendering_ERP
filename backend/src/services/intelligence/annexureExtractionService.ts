import { PageText } from '../../types/intelligence';
import { classifyPageTags } from './documentPageContext';
import { PRODUCTION_FIELDS, FieldSection } from './fieldDefinitions';
import { productionFieldPipeline } from './productionFieldPipeline';
import { ExtractedProductionField } from './extractedProductionField';
import { DocumentMap } from './documentMapBuilder';
import { ExtractedTable } from './tableExtractionService';
import { ExtractFieldOptions } from './fieldLevelExtractor';

/** Fields commonly found only in annexures / schedules / forms. */
export const ANNEXURE_FIELD_IDS = [
  'turnoverRequirements',
  'experienceRequirements',
  'requiredDocuments',
  'technicalRequirements',
  'financialRequirements',
  'gstRequirement',
  'epfRequirement',
  'esiRequirement',
  'labourLicense',
  'certificationsRequired',
  'msmeRequirement',
  'oemRequirement',
  'mafRequired',
  'netWorthRequirement',
  'manpowerRequirements',
] as const;

const ANNEXURE_SECTIONS: FieldSection[] = ['eligibility', 'documents', 'technical', 'compliance'];

function isAnnexurePage(page: PageText): boolean {
  const tags = classifyPageTags(page);
  return (
    tags.includes('annexure') ||
    tags.includes('appendix') ||
    tags.includes('schedule') ||
    /\bform\s+(?:no|iii|iv|v)\b/i.test(page.text.slice(0, 800))
  );
}

class AnnexureExtractionService {
  filterAnnexurePages(pages: PageText[]): PageText[] {
    return pages.filter(isAnnexurePage);
  }

  /** Second-pass extraction limited to annexure / schedule / appendix / form pages. */
  async extractMissingFromAnnexures(
    existing: ExtractedProductionField[],
    pages: PageText[],
    documentMap: DocumentMap,
    structuredTables: ExtractedTable[]
  ): Promise<ExtractedProductionField[]> {
    const annexurePages = this.filterAnnexurePages(pages);
    if (!annexurePages.length) return existing;

    const byId = new Map(existing.map((f) => [f.id, f]));
    const annexureTables = structuredTables.filter((t) =>
      annexurePages.some((p) => p.pageNumber === t.pageNumber)
    );

    for (const id of ANNEXURE_FIELD_IDS) {
      if (byId.has(id)) continue;

      const def = PRODUCTION_FIELDS.find((f) => f.id === id);
      if (!def || !ANNEXURE_SECTIONS.includes(def.section)) continue;

      const opts: ExtractFieldOptions = {
        documentMap,
        annexurePass: true,
        structuredTables: annexureTables,
      };

      const verified = await productionFieldPipeline.processField(def, annexurePages, opts);
      if (!verified) continue;

      byId.set(id, {
        id: def.id,
        label: def.label,
        mergeKey: def.mergeKey,
        section: def.section,
        value: verified.value,
        sourcePage: verified.sourcePage,
        sourceText: verified.sourceText,
        confidence: verified.confidence,
        validated: true,
        needsReview: verified.needsReview,
      });
    }

    const ordered: ExtractedProductionField[] = [];
    for (const def of PRODUCTION_FIELDS) {
      const f = byId.get(def.id);
      if (f) ordered.push(f);
    }
    return ordered;
  }
}

export const annexureExtractionService = new AnnexureExtractionService();
