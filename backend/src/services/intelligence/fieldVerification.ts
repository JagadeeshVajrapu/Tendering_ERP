import { CONFIDENCE_THRESHOLD } from './fields';

export const REVIEW_CONFIDENCE_THRESHOLD = 0.9;
import { MergedField } from '../../types/intelligence';

export const PLACEHOLDER_VALUES = new Set([
  'not found',
  'n/a',
  'na',
  'unknown',
  'nil',
  'none',
  '-',
  '—',
  'tbd',
  'refer tender',
]);

/** Field is displayable only when verified with value, page, and confidence. */
export function isVerifiedField(field?: MergedField): boolean {
  if (!field?.value) return false;
  if (field.validated === false) return false;
  if (field.confidence < CONFIDENCE_THRESHOLD) return false;
  if (!field.sourcePages?.length) return false;

  const values = Array.isArray(field.value) ? field.value : [String(field.value)];
  const hasReal = values.some((v) => {
    const t = String(v).trim();
    if (!t || t.length < 2) return false;
    if (PLACEHOLDER_VALUES.has(t.toLowerCase())) return false;
    if (/^not\s*found$/i.test(t)) return false;
    return true;
  });

  return hasReal;
}

export function verifiedScalar(field?: MergedField): string | null {
  if (!isVerifiedField(field)) return null;
  const v = Array.isArray(field!.value) ? field!.value[0] : field!.value;
  return String(v).trim();
}

export function formatSourcePages(field: MergedField): string {
  const pages = [...field.sourcePages].sort((a, b) => a - b);
  return pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages.join(', ')}`;
}

export function fieldConfidence(field: MergedField): number {
  return Math.round(field.confidence * 100);
}

export function needsReview(field?: MergedField): boolean {
  if (!isVerifiedField(field)) return false;
  return field!.confidence < REVIEW_CONFIDENCE_THRESHOLD;
}
