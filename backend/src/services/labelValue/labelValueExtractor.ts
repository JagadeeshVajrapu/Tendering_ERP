import { PageText } from '../../types/intelligence';
import { LabelValuePair } from '../../types/labelValuePair';
import { discoverAllParameters } from '../parameterDiscovery/dynamicParameterDiscoveryEngine';

/** Delegates to Dynamic Parameter Discovery Engine (all patterns, no schema). */
export function extractLabelValuePairs(
  pages: PageText[],
  opts?: { maxPage?: number | null }
): LabelValuePair[] {
  return discoverAllParameters(pages, opts).map((p) => ({
    label: p.parameterName,
    value: p.parameterValue,
    page: p.pageNumber,
    confidence: p.confidence,
    sourceText: p.sourceText,
  }));
}
