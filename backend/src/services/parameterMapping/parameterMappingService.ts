import { Types } from 'mongoose';
import { DynamicParameterRecord } from '../../types/dynamicParameter';
import { ParameterMappingResult } from '../../types/parameterMapping';
import { FieldLocatorResult } from '../../types/fieldLocator';
import { SourceFieldRecord } from '../masterDataset/masterDatasetBuilder';
import { parameterDiscoveryService } from '../parameterDiscovery/parameterDiscoveryService';
import { mapDiscoveredParametersToMasterFields } from './parameterMappingEngine';
import {
  getMappingTableForDisplay,
  MAPPING_ENGINE_EXAMPLES,
  normalizeParameterNameForMapping,
  resolveRuleForParameter,
} from './businessFieldMappingRegistry';

class ParameterMappingService {
  mapParameters(parameters: DynamicParameterRecord[]): ParameterMappingResult {
    const mappedFields = mapDiscoveredParametersToMasterFields(parameters);

    const unmappedParameters = parameters
      .filter((p) => {
        if (!p.parameterValue?.trim()) return false;
        return !resolveRuleForParameter(normalizeParameterNameForMapping(p.parameterName));
      })
      .map((p) => ({
        parameterName: p.parameterName,
        parameterValue: p.parameterValue.trim(),
        sourcePage: p.sourcePage,
        confidence: p.confidence,
      }));

    return {
      documentId: '',
      tenderId: '',
      totalDiscovered: parameters.length,
      mappedCount: mappedFields.length,
      mappedFields,
      unmappedCount: unmappedParameters.length,
      unmappedParameters,
    };
  }

  toSourceFieldRecords(mapped: ParameterMappingResult['mappedFields']): SourceFieldRecord[] {
    return mapped.map((m) => ({
      fieldName: m.businessFieldName,
      value: m.value,
      confidence: m.confidence,
      sourcePage: m.sourcePage,
      sourceText: m.sourceText,
      extractionMethod: `parameter_map:${m.sourceParameterName}`,
    }));
  }

  toFieldLocatorResults(mapped: ParameterMappingResult['mappedFields']): FieldLocatorResult[] {
    return mapped.map((m) => ({
      fieldName: m.businessFieldName,
      value: m.value,
      sourcePage: m.sourcePage,
      sourceText: m.sourceText,
      extractionMethod: 'alias',
      confidence: m.confidence,
    }));
  }

  applyMappingsToLocatorFields(
    fields: FieldLocatorResult[],
    mapped: ParameterMappingResult['mappedFields'],
    opts?: { overwrite?: boolean }
  ): FieldLocatorResult[] {
    const out = [...fields];

    for (const m of mapped) {
      const name = m.businessFieldName;
      const idx = out.findIndex((f) => f.fieldName === name);
      const patch: FieldLocatorResult = {
        fieldName: name,
        value: m.value,
        sourcePage: m.sourcePage,
        sourceText: m.sourceText,
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

  async mapDocument(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    parameters?: DynamicParameterRecord[]
  ): Promise<ParameterMappingResult & { mappingTable: ReturnType<typeof getMappingTableForDisplay> }> {
    let list = parameters;

    if (!list?.length) {
      const engine = await parameterDiscoveryService.runEngineForDocument(documentId, tenderId, false);
      list = engine.parameters;
    }

    const result = this.mapParameters(list);
    return {
      ...result,
      documentId: String(documentId),
      tenderId: String(tenderId),
      mappingTable: getMappingTableForDisplay(),
      mappingExamples: MAPPING_ENGINE_EXAMPLES,
    };
  }
}

export const parameterMappingService = new ParameterMappingService();
