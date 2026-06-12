import { Types } from 'mongoose';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { ocrNormalizationService } from '../ocr/ocrNormalizationService';
import { applyEnterpriseAliasToCandidates } from './enterpriseTenderAliasEngine';
import { supplementCandidatesFromOcrRecords } from './ocrRecordCandidateSupplement';
import {
  isExtractableCandidateRow,
  rowResolvesAsCoreParameter,
} from './tenderParameterQualityEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { STEP1_CANDIDATE_AI_MODEL } from '../../types/tenderParameterCandidateExtraction';

async function loadOcrRecords(documentId: Types.ObjectId) {
  let ocrRecords = await ocrNormalizationService.getStored(documentId);
  if (!ocrRecords.length) {
    const normalized = await ocrNormalizationService.getOrNormalize(documentId, { refresh: true });
    ocrRecords = normalized.records;
  }
  return ocrRecords;
}

/**
 * Build validated candidate rows directly from OCR label:value pairs (bypasses AI).
 */
export async function buildValidatedCandidateRowsFromOcr(
  documentId: Types.ObjectId
): Promise<TenderParameterCandidateRow[]> {
  const ocrRecords = await loadOcrRecords(documentId);
  if (!ocrRecords.length) return [];

  const supplemented = supplementCandidatesFromOcrRecords(
    [],
    ocrRecords.map((r) => ({
      label: r.label,
      value: r.value,
      page: r.page,
      sourceText: r.sourceText,
    }))
  );

  const { candidates: aliasMapped } = applyEnterpriseAliasToCandidates(supplemented, {});

  return aliasMapped
    .map((row) => ({
      ...row,
      isCoreParameter:
        row.isCoreParameter ?? isAllowedMasterParameter(row.parameter, row.canonicalKey),
    }))
    .filter(
      (row) =>
        rowResolvesAsCoreParameter(row) ||
        isExtractableCandidateRow({
          ...row,
          originalLabel: row.originalLabel || row.parameter,
        })
    )
    .map((row) => ({
      ...row,
      validationPassed: true as const,
      validationStatus: (rowResolvesAsCoreParameter(row)
        ? 'VALID'
        : 'REVIEW') as TenderParameterCandidateRow['validationStatus'],
      validationReason: 'Built from OCR label:value records',
      validationRule: 'ocr_direct',
      rankWinner: true,
      confidence: row.confidence || 78,
    }));
}

/**
 * Persist OCR-derived candidates when the candidate table is empty or force-cleared.
 */
export async function ensureCandidatesFromOcrFallback(
  documentId: Types.ObjectId,
  tenderId: Types.ObjectId,
  opts?: { force?: boolean }
): Promise<{ inserted: number; candidates: TenderParameterCandidateRow[] }> {
  if (!opts?.force) {
    const existing = await TenderParameterCandidate.countDocuments({ documentId });
    if (existing > 0) {
      return { inserted: 0, candidates: [] };
    }
  }

  const storable = await buildValidatedCandidateRowsFromOcr(documentId);
  if (!storable.length) {
    return { inserted: 0, candidates: [] };
  }

  if (opts?.force) {
    await TenderParameterCandidate.deleteMany({ documentId });
  }

  await TenderParameterCandidate.insertMany(
    storable.map((c) => ({
      documentId,
      parameter: c.parameter,
      originalLabel: c.originalLabel,
      normalizedParameter: c.normalizedParameter || c.parameter,
      canonicalKey: c.canonicalKey,
      category: c.category || '',
      aliasMatchScore: c.aliasMatchScore ?? 0,
      aliasMatchMethod: c.aliasMatchMethod || '',
      isCoreParameter: c.isCoreParameter ?? false,
      value: c.value,
      pageNumber: c.page,
      confidence: c.confidence,
      sourceText: c.sourceText,
      aiModel: `ocr-fallback:${STEP1_CANDIDATE_AI_MODEL}`,
      rankScore: c.rankScore ?? 0,
      rankWinner: c.rankWinner ?? true,
      validationPassed: true,
      validationStatus: c.validationStatus || 'REVIEW',
      validationReason: c.validationReason || 'OCR label:value fallback',
      validationRule: c.validationRule || 'ocr_fallback',
    }))
  );

  console.log('[OCR Fallback] Stored candidates from OCR records', {
    documentId: String(documentId),
    stored: storable.length,
  });

  return { inserted: storable.length, candidates: storable };
}
