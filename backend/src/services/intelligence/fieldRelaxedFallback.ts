import { PageText } from '../../types/intelligence';
import { ExtractedProductionField } from './extractedProductionField';
import { DocumentMap } from './documentMapBuilder';

/**
 * Relaxed fallback disabled — production must not accept weak candidates.
 * A blank field is better than a wrong field.
 */
export function relaxedExtractAll(
  _pages: PageText[],
  _documentMap?: DocumentMap
): ExtractedProductionField[] {
  return [];
}
