import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import {
  TenderParameterAliasMappingResult,
  TenderParameterAliasMappingRow,
} from '../../types/tenderParameterAlias';
import { applyEnterpriseAliasToCandidates, resolveEnterpriseAlias } from './enterpriseTenderAliasEngine';
import { normalizeAliasMapAndValidateCandidates } from './tenderParameterAliasEngine';

class TenderParameterAliasMappingService {
  mapLabel(rawLabel: string, serviceCategory?: string) {
    return resolveEnterpriseAlias(rawLabel, {
      serviceCategory: serviceCategory as import('../../types/tenderServiceClassification').TenderServiceCategory,
    });
  }

  mapRows<
    T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
  >(rows: T[], serviceCategory?: string): TenderParameterAliasMappingRow[] {
    return applyEnterpriseAliasToCandidates(rows, {
      serviceCategory: serviceCategory as import('../../types/tenderServiceClassification').TenderServiceCategory,
    }).candidates.map((row) => ({
      parameter: row.parameter,
      originalLabel: row.originalLabel,
      normalizedParameter: row.normalizedParameter || row.parameter,
      canonicalKey: row.canonicalKey || '',
      value: row.value,
      page: row.page,
      confidence: row.confidence,
      sourceText: row.sourceText,
      aliasMapped: !!row.aliasMapped,
      aliasMatchScore: row.aliasMatchScore ?? 0,
      matchMethod: row.aliasMatchMethod || 'none',
    }));
  }

  mapAndValidate<
    T extends { parameter: string; value: string; page: number; confidence: number; sourceText: string },
  >(rows: T[], serviceCategory?: string): TenderParameterAliasMappingResult {
    const { candidates, aliasMapped, rejectedByDictionary } = normalizeAliasMapAndValidateCandidates(rows, {
      serviceCategory: serviceCategory as import('../../types/tenderServiceClassification').TenderServiceCategory,
    });

    return {
      mappings: candidates.map((row) => ({
        parameter: row.parameter,
        originalLabel: row.originalLabel,
        normalizedParameter: row.normalizedParameter || row.parameter,
        canonicalKey: row.canonicalKey || '',
        value: row.value,
        page: row.page,
        confidence: row.confidence,
        sourceText: row.sourceText,
        aliasMapped: !!row.aliasMapped,
        aliasMatchScore: row.aliasMatchScore ?? 0,
        matchMethod: row.aliasMatchMethod || 'none',
      })),
      stats: {
        inputCount: rows.length,
        aliasMappedCount: aliasMapped.filter((r) => r.aliasMapped).length,
        unmappedCount: aliasMapped.filter((r) => !r.aliasMapped).length,
        validatedCount: candidates.length,
        rejectedCount: rejectedByDictionary.length,
      },
    };
  }

  async getDocumentAliasMappings(documentId: string): Promise<TenderParameterAliasMappingResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const stored = await TenderParameterCandidate.find({ documentId: document._id })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();

    const rows = stored.map((s) => ({
      parameter: s.originalLabel || s.parameter,
      value: s.value,
      page: s.pageNumber,
      confidence: s.confidence,
      sourceText: s.sourceText,
    }));

    return this.mapAndValidate(rows, document.serviceCategory);
  }
}

export const tenderParameterAliasMappingService = new TenderParameterAliasMappingService();
