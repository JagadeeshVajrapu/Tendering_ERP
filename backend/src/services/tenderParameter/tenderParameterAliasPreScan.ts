import { mapParameterAlias, normalizeAliasKey } from './tenderParameterAliasEngine';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { normalizeToDictionaryCanonical } from './masterTenderParameterDictionaryEngine';

export interface OcrLabelValueRecord {
  label: string;
  value: string;
  page: number;
  sourceText?: string;
}

export interface AliasPreScanResult {
  mappedCount: number;
  hintsText: string;
  rows: Array<{
    parameter: string;
    originalLabel: string;
    value: string;
    page: number;
    canonicalKey: string;
  }>;
}

/** Step 4 — map OCR label:value rows through the alias catalog before AI extraction. */
export function buildAliasHintsFromOcrRecords(
  records: OcrLabelValueRecord[],
  opts?: { serviceCategory?: TenderServiceCategory | '' }
): AliasPreScanResult {
  const rows: AliasPreScanResult['rows'] = [];
  const hintLines: string[] = [];

  for (const record of records) {
    const label = String(record.label || '').trim();
    const value = String(record.value || '').trim();
    if (!label || !value || value.length < 2) continue;

    const mapped = mapParameterAlias(label, { serviceCategory: opts?.serviceCategory });
    const dict = normalizeToDictionaryCanonical(mapped.parameter, mapped.canonicalKey);
    if (!dict) continue;

    rows.push({
      parameter: dict.canonical,
      originalLabel: mapped.originalLabel,
      value,
      page: record.page,
      canonicalKey: dict.key,
    });

    const aliasNote =
      normalizeAliasKey(mapped.originalLabel) !== normalizeAliasKey(dict.canonical)
        ? ` (OCR: "${mapped.originalLabel}" → ${dict.canonical})`
        : '';
    hintLines.push(`[Page ${record.page}] ${dict.canonical}: ${value}${aliasNote}`);
  }

  const capped = hintLines.slice(0, 120);
  const hintsText = capped.length
    ? `Pre-mapped alias label:value pairs from OCR (verify, correct, and add missing tender fields):\n${capped.join('\n')}`
    : '';

  return {
    mappedCount: rows.length,
    hintsText,
    rows,
  };
}
