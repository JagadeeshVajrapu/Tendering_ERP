import { PageText } from '../../types/intelligence';
import { DocumentMap } from './documentMapBuilder';
import { PRODUCTION_FIELDS } from './fieldDefinitions';
import { productionFieldPipeline } from './productionFieldPipeline';
import { ExtractedProductionField } from './extractedProductionField';
import { ExtractedTable } from './tableExtractionService';
import { filterPagesByContext } from './documentPageContext';
import { DICTIONARY_FIELD_IDS } from './fieldDictionaryEngine';
import { mapWithConcurrency } from '../../utils/concurrency';
import { env } from '../../config/env';

/** Recovery search order: main → tables → annexures → forms/schedules */
const RECOVERY_SEARCH_PASSES: Array<{
  name: string;
  filter: (pages: PageText[]) => PageText[];
}> = [
  {
    name: 'main',
    filter: (pages) => pages,
  },
  {
    name: 'tables',
    filter: (pages) => filterPagesByContext(pages, 'table', 'financial'),
  },
  {
    name: 'annexures',
    filter: (pages) => filterPagesByContext(pages, 'annexure', 'eligibility'),
  },
  {
    name: 'schedules',
    filter: (pages) => filterPagesByContext(pages, 'annexure', 'timeline'),
  },
];

const RECOVERY_FIELD_IDS = [
  'tenderNumber',
  'estimatedTenderValue',
  'emdAmount',
  'submissionMode',
  'bidSystem',
  'turnoverRequirements',
  'experienceRequirements',
  'gstRequirement',
  'epfRequirement',
  'esiRequirement',
  'contractDuration',
  'workLocation',
  'reverseAuction',
  'mafRequired',
];

class MissingFieldRecoveryService {
  async recoverMissingFields(
    existing: ExtractedProductionField[],
    pages: PageText[],
    documentMap: DocumentMap,
    structuredTables: ExtractedTable[]
  ): Promise<ExtractedProductionField[]> {
    const byId = new Map(existing.map((f) => [f.id, f]));
    const missingIds = RECOVERY_FIELD_IDS.filter((id) => {
      if (byId.has(id)) return false;
      return DICTIONARY_FIELD_IDS.has(id) || PRODUCTION_FIELDS.some((f) => f.id === id);
    });

    if (!missingIds.length) return existing;

    for (const pass of RECOVERY_SEARCH_PASSES) {
      const searchPages = pass.filter(pages);
      if (!searchPages.length) continue;

      const tables = structuredTables.filter((t) =>
        searchPages.some((p) => p.pageNumber === t.pageNumber)
      );

      const pageMap = new Map(searchPages.map((p) => [p.pageNumber, p]));
      const pendingIds = missingIds.filter((id) => !byId.has(id));

      await mapWithConcurrency(pendingIds, env.intelligence.fieldConcurrency, async (id) => {
        if (byId.has(id)) return;
        const def = PRODUCTION_FIELDS.find((f) => f.id === id);
        if (!def) return;

        const result = await productionFieldPipeline.processField(def, searchPages, {
          documentMap,
          structuredTables: tables,
          pageMap,
          recoveryPass: true,
          annexurePass: pass.name === 'annexures' || pass.name === 'schedules',
        });

        if (!result) return;

        byId.set(id, {
          id: def.id,
          label: def.label,
          mergeKey: def.mergeKey,
          section: def.section,
          value: result.value,
          sourcePage: result.sourcePage,
          sourceText: result.sourceText,
          confidence: result.confidence,
          validated: true,
          needsReview: result.needsReview,
        });
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

export const missingFieldRecoveryService = new MissingFieldRecoveryService();
