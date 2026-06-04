import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import {
  DynamicParameterEngineResult,
  DynamicParameterRecord,
} from '../../types/dynamicParameter';
import { OcrNormalizedRecord } from '../../types/ocrNormalization';
import { DiscoveredParameter } from '../../types/parameterDiscovery';
import {
  buildDynamicDiscoveryResult,
  discoverAllParameters,
  discoverAllParametersAsRecords,
  buildDiscoveryResult,
} from './dynamicParameterDiscoveryEngine';

export {
  discoverAllParameters,
  discoverAllParametersAsRecords,
  buildDiscoveryResult,
  groupDiscoveredParameters,
} from './dynamicParameterDiscoveryEngine';

/** @deprecated Use discoverAllParameters */
export function discoverDynamicParameters(
  pages: PageText[],
  opts?: { maxPage?: number | null; normalizedRecords?: OcrNormalizedRecord[] }
): DiscoveredParameter[] {
  return discoverAllParameters(pages, opts);
}

export function runDynamicParameterEngine(
  pages: PageText[],
  opts?: { maxPage?: number | null; normalizedRecords?: OcrNormalizedRecord[] }
): DynamicParameterRecord[] {
  return discoverAllParametersAsRecords(pages, opts);
}

export function buildDynamicParameterEngineResult(
  documentId: string,
  tenderId: string,
  pages: PageText[],
  opts?: { maxPage?: number | null; normalizedRecords?: OcrNormalizedRecord[] }
): DynamicParameterEngineResult {
  return buildDynamicDiscoveryResult(documentId, tenderId, pages, opts);
}

export async function persistDynamicParameters(
  documentId: Types.ObjectId,
  tenderId: Types.ObjectId,
  parameters: DynamicParameterRecord[]
): Promise<void> {
  const { DocumentDiscoveredParameter } = await import('../../models/DocumentDiscoveredParameter');
  const { classifyParameterGroup } = await import('./parameterGroupingEngine');

  await DocumentDiscoveredParameter.deleteMany({ documentId });
  if (!parameters.length) return;

  await DocumentDiscoveredParameter.insertMany(
    parameters.map((p) => ({
      documentId,
      tenderId,
      parameterName: p.parameterName,
      parameterValue: p.parameterValue,
      pageNumber: p.sourcePage,
      sourceText: `${p.parameterName}: ${p.parameterValue}`,
      confidence: p.confidence,
      category: classifyParameterGroup(p.parameterName, p.parameterValue),
    }))
  );
}
