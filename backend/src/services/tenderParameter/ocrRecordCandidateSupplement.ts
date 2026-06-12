import { RawTenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { mapParameterAlias } from './tenderParameterAliasEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import {
  isExtractableCandidateRow,
  isGarbageTenderParameterLabel,
  isPlausibleTenderParameterLabel,
  rowResolvesAsCoreParameter,
} from './tenderParameterQualityEngine';
import { OcrLabelValueRecord } from './tenderParameterAliasPreScan';

const PLACEHOLDER_VALUE_RX =
  /\b(xxxx|xxx|tbd|tba|n\/a|na|nil|none|not\s+available|to\s+be\s+(?:advised|filled|decided))\b/i;

function isAcceptableOcrValue(value: string): boolean {
  const v = value.trim();
  if (!v || v.length < 2 || v.length > 500) return false;
  if (PLACEHOLDER_VALUE_RX.test(v)) return false;
  if (/^[\d.,\s₹Rs/-]+$/.test(v) && v.replace(/[^\d]/g, '').length < 2) return false;
  return true;
}

/**
 * Supplement AI extraction with structured OCR label:value pairs when AI yields few results.
 */
export function supplementCandidatesFromOcrRecords(
  existing: RawTenderParameterCandidateRow[],
  records: OcrLabelValueRecord[]
): RawTenderParameterCandidateRow[] {
  const seen = new Set(
    existing.map((r) => `${r.page}|${r.parameter.toLowerCase()}|${r.value.toLowerCase()}`)
  );
  const merged = [...existing];

  for (const record of records) {
    const label = String(record.label || '').trim();
    const value = String(record.value || '').trim();
    if (!label || !isAcceptableOcrValue(value)) continue;
    if (isGarbageTenderParameterLabel(label)) continue;

    const mapped = mapParameterAlias(label);
    const parameter = mapped.parameter || label;
    if (
      !mapped.aliasMatched &&
      !isPlausibleTenderParameterLabel(label) &&
      !isAllowedMasterParameter(label, mapped.canonicalKey) &&
      !mapped.canonicalKey
    ) {
      continue;
    }
    const key = `${record.page}|${parameter.toLowerCase()}|${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const candidate = {
      parameter,
      originalLabel: label,
      value,
      page: record.page,
      confidence: 78,
      sourceText: record.sourceText || `${label}: ${value}`,
      category: '',
      isCoreParameter: isAllowedMasterParameter(parameter, mapped.canonicalKey),
      canonicalKey: mapped.canonicalKey,
    };
    if (!rowResolvesAsCoreParameter(candidate) && !isExtractableCandidateRow(candidate)) {
      continue;
    }

    merged.push({
      parameter: candidate.parameter,
      value: candidate.value,
      page: candidate.page,
      confidence: candidate.confidence,
      sourceText: candidate.sourceText,
      category: candidate.category,
      isCoreParameter: candidate.isCoreParameter,
    });
  }

  return merged;
}
