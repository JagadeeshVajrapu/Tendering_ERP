import { PageText } from '../../types/intelligence';
import { OcrNormalizedRecord } from '../../types/ocrNormalization';
import { DiscoveredParameter } from '../../types/parameterDiscovery';
import {
  DynamicParameterEngineResult,
  DynamicParameterRecord,
} from '../../types/dynamicParameter';
import { extractAllParametersFromPages } from './comprehensiveParameterExtractor';
import { finalizeDiscoveredParameters } from './parameterExtractionValidator';
import { classifyParameterGroup, groupDiscoveredParameters } from './parameterGroupingEngine';
import { scanTenderLabelParameters } from './tenderLabelParameterScanner';

export type { DiscoveredParameter as DiscoveredParameterRecord };
export { groupDiscoveredParameters };

function fromNormalizedRecords(records: OcrNormalizedRecord[]): DiscoveredParameter[] {
  return records.map((r) => ({
    parameterName: r.label,
    parameterValue: r.value,
    pageNumber: r.page,
    sourceText: r.sourceText ?? `${r.label}: ${r.value}`,
    confidence: 96,
    category: classifyParameterGroup(r.label, r.value),
  }));
}

function mergeDiscoveredSources(sources: DiscoveredParameter[]): DiscoveredParameter[] {
  const byKey = new Map<string, DiscoveredParameter>();

  for (const p of sources) {
    const key = `${p.pageNumber}|${p.parameterName.toLowerCase().trim()}|${p.parameterValue.toLowerCase().trim()}`;
    const existing = byKey.get(key);
    if (!existing || p.confidence > existing.confidence) {
      byKey.set(key, p);
    }
  }

  return Array.from(byKey.values());
}

export interface DiscoverAllParametersOptions {
  maxPage?: number | null;
  normalizedRecords?: OcrNormalizedRecord[];
}

/**
 * Dynamic Parameter Discovery Engine — discovers every parameter:value pair.
 * Sources (no fixed schema, no 37-field limit):
 * 1. OCR normalized records (Label | Value | Page)
 * 2. Field-locator tender labels (Tender Number, EMD, …)
 * 3. Comprehensive OCR scan (: = - | tab, all pages)
 */
export function discoverAllParameters(
  pages: PageText[],
  opts?: DiscoverAllParametersOptions
): DiscoveredParameter[] {
  const normalized = opts?.normalizedRecords ?? [];
  const maxPage = opts?.maxPage === null ? Infinity : (opts?.maxPage ?? Infinity);

  const fromNorm = fromNormalizedRecords(normalized);
  const fromScanner = scanTenderLabelParameters(pages);
  const fromComprehensive = extractAllParametersFromPages(pages, { maxPage });

  const merged = mergeDiscoveredSources([...fromNorm, ...fromScanner, ...fromComprehensive]);
  const withCategory = merged.map((p) => ({
    ...p,
    category: p.category ?? classifyParameterGroup(p.parameterName, p.parameterValue),
  }));

  return finalizeDiscoveredParameters(withCategory);
}

export function discoverAllParametersAsRecords(
  pages: PageText[],
  opts?: DiscoverAllParametersOptions
): DynamicParameterRecord[] {
  return discoverAllParameters(pages, opts).map((p) => ({
    parameterName: p.parameterName,
    parameterValue: p.parameterValue,
    sourcePage: p.pageNumber,
    confidence: p.confidence,
  }));
}

export function buildDynamicDiscoveryResult(
  documentId: string,
  tenderId: string,
  pages: PageText[],
  opts?: DiscoverAllParametersOptions
): DynamicParameterEngineResult {
  const maxPage = opts?.maxPage === null ? Infinity : (opts?.maxPage ?? Infinity);
  const pagesScanned = pages.filter((p) => p.pageNumber >= 1 && p.pageNumber <= maxPage).length;
  const parameters = discoverAllParametersAsRecords(pages, opts);

  return {
    documentId,
    tenderId,
    pagesScanned,
    totalFound: parameters.length,
    parameters,
  };
}

export function buildDiscoveryResult(
  documentId: string,
  tenderId: string,
  pages: PageText[],
  opts?: DiscoverAllParametersOptions
) {
  const engine = buildDynamicDiscoveryResult(documentId, tenderId, pages, opts);
  const parameters = discoverAllParameters(pages, opts);
  return {
    documentId: engine.documentId,
    tenderId: engine.tenderId,
    pagesScanned: engine.pagesScanned,
    totalFound: engine.totalFound,
    parameters,
    grouped: groupDiscoveredParameters(parameters),
  };
}
