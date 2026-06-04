import { Types } from 'mongoose';
import { FieldLocatorResult } from '../../types/fieldLocator';
import { LabelValueExtractionResult } from '../../types/labelValuePair';
import {
  MappedLabelValueField,
  mapLabelValuePairsToFields,
  getMappingTableForDisplay,
} from './labelValueFieldMapping';
import { labelValueService } from './labelValueService';

export interface LabelValueMappingResult {
  documentId: string;
  tenderId: string;
  extraction: LabelValueExtractionResult;
  mappedFields: MappedLabelValueField[];
  mappingTable: ReturnType<typeof getMappingTableForDisplay>;
}

class LabelValueMappingService {
  async mapDocument(documentId: Types.ObjectId, tenderId: Types.ObjectId, refresh = false) {
    const extraction = refresh
      ? await labelValueService.extractAndStore(documentId, tenderId)
      : await labelValueService.getLabelValuePairs(String(documentId), false);

    const mappedFields = mapLabelValuePairsToFields(extraction.pairs);

    return {
      documentId: String(documentId),
      tenderId: String(tenderId),
      extraction,
      mappedFields,
      mappingTable: getMappingTableForDisplay(),
    };
  }

  /** Apply mapped values to field locator results (fill gaps only by default). */
  applyMappingsToLocatorFields(
    fields: FieldLocatorResult[],
    mapped: MappedLabelValueField[],
    opts?: { overwrite?: boolean }
  ): FieldLocatorResult[] {
    const out = [...fields];

    for (const m of mapped) {
      const idx = out.findIndex((f) => f.fieldName === m.targetField);
      const patch: FieldLocatorResult = {
        fieldName: m.targetField,
        value: m.value,
        sourcePage: m.page,
        sourceText: m.sourceText || `${m.sourceLabel}: ${m.value}`,
        extractionMethod: 'alias',
        confidence: m.confidence,
      };

      if (idx < 0) {
        out.push(patch);
      } else if (opts?.overwrite || !out[idx].value?.trim()) {
        out[idx] = patch;
      }
    }

    return out;
  }
}

export const labelValueMappingService = new LabelValueMappingService();
