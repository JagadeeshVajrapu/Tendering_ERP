import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import {
  TenderParameterCandidateExtractionResult,
  TenderParameterCandidateRow,
} from '../../types/tenderParameterCandidateExtraction';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { TenderServiceClassification } from '../../models/TenderServiceClassification';
import { processEnterpriseAliasAndValidation } from './enterpriseAliasValidationEngine';
import { dynamicParameterDiscoveryService } from './dynamicParameterDiscoveryService';
import { enterpriseSectionDetectionService } from '../tenderIntelligence/enterpriseSectionDetectionService';
import { isGenuineTenderParameterRow, rowResolvesAsCoreParameter } from './tenderParameterQualityEngine';
import { qualifiesForAdditionalTenderParameters } from './enterpriseDynamicParameterFilteringEngine';
import { documentPageService } from '../ocr/documentPageService';
import { DocumentPage } from '../../models/DocumentPage';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderIntelligenceLayer } from '../../models/TenderIntelligenceLayer';

class TenderParameterCandidatePostProcessingService {
  private mapStored(row: {
    parameter: string;
    originalLabel?: string;
    canonicalKey?: string;
    category?: string;
    isCoreParameter?: boolean;
    value: string;
    pageNumber: number;
    confidence: number;
    sourceText: string;
    rankScore?: number;
    rankWinner?: boolean | null;
    validationPassed?: boolean | null;
    validationReason?: string;
    validationRule?: string;
  }): TenderParameterCandidateRow {
    return {
      parameter: row.parameter,
      originalLabel: row.originalLabel || row.parameter,
      canonicalKey: row.canonicalKey,
      category: row.category,
      isCoreParameter: row.isCoreParameter,
      value: row.value,
      page: row.pageNumber,
      confidence: row.confidence,
      sourceText: row.sourceText,
      rankScore: row.rankScore,
      rankWinner: row.rankWinner ?? undefined,
      validationPassed: row.validationPassed,
      validationReason: row.validationReason,
      validationRule: row.validationRule,
    };
  }

  async loadPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  private async resolveServiceCategory(documentId: Types.ObjectId): Promise<TenderServiceCategory | ''> {
    const doc = await TenderServiceClassification.findOne({ documentId }).sort({ createdAt: -1 }).lean();
    return (doc?.serviceCategory as TenderServiceCategory) || '';
  }

  async rankAndValidate(
    documentId: Types.ObjectId,
    pages?: PageText[],
    serviceCategory?: TenderServiceCategory | ''
  ): Promise<{
    candidates: TenderParameterCandidateRow[];
    rankingStats: TenderParameterCandidateExtractionResult['rankingStats'];
    validationStats: TenderParameterCandidateExtractionResult['validationStats'];
  }> {
    const stored = await TenderParameterCandidate.find({ documentId }).sort({ pageNumber: 1, parameter: 1 }).lean();
    if (!stored.length) {
      return {
        candidates: [],
        rankingStats: { inputCount: 0, winnerCount: 0, rejectedByContext: 0, duplicateGroups: 0 },
        validationStats: {
          inputCount: 0,
          validCount: 0,
          rejectedCount: 0,
          rejectedByContext: 0,
          rejectedByDate: 0,
          rejectedByAmount: 0,
          rejectedByPeriod: 0,
        },
      };
    }

    const pageTexts = pages?.length ? pages : await this.loadPages(documentId);
    const category = serviceCategory ?? (await this.resolveServiceCategory(documentId));

    let pageClassifications: import('../tenderIntelligence/enterpriseSectionDetectionEngine').PageSectionClassification[] =
      [];
    try {
      const sectionIntel = await enterpriseSectionDetectionService.analyzeAndStore(
        documentId,
        (await TenderDocument.findById(documentId))?.tenderId ?? documentId,
        pageTexts,
        { refresh: false }
      );
      pageClassifications = sectionIntel.pageClassifications;
    } catch {
      pageClassifications = [];
    }

    const rawRows = stored.map((s) => ({
      parameter: s.originalLabel || s.parameter,
      value: s.value,
      page: s.pageNumber,
      confidence: s.confidence,
      sourceText: s.sourceText,
      category: s.category,
      isCoreParameter: s.isCoreParameter,
    }));

    let tenderType = '';
    try {
      const intel = await TenderIntelligenceLayer.findOne({ documentId }).lean();
      tenderType = intel?.tenderType || '';
    } catch {
      tenderType = '';
    }

    const aliasValidation = processEnterpriseAliasAndValidation(rawRows, {
      serviceCategory: category,
      pageTexts,
      pageClassifications,
      tenderType,
    });
    const aliasNormalized = aliasValidation.aliasNormalized;

    await Promise.all(
      aliasNormalized.map((row) =>
        TenderParameterCandidate.updateOne(
          {
            documentId,
            pageNumber: row.page,
            value: row.value,
            $or: [{ parameter: row.parameter }, { originalLabel: row.originalLabel }],
          },
          {
            $set: {
              parameter: row.parameter,
              originalLabel: row.originalLabel,
              normalizedParameter: row.normalizedParameter || row.parameter,
              canonicalKey: row.canonicalKey || '',
              aliasMatchScore: row.aliasMatchScore ?? 0,
              aliasMatchMethod: row.aliasMatchMethod || '',
              category: row.category || '',
              isCoreParameter: row.isCoreParameter ?? false,
            },
          }
        )
      )
    );

    const enterpriseValidation = {
      storable: aliasValidation.validated.map((row) => {
        const base =
          aliasNormalized.find(
            (c) =>
              c.page === row.page &&
              c.parameter === row.parameter &&
              c.value === row.value
          ) ||
          aliasNormalized.find(
            (c) =>
              c.page === row.page &&
              (c.originalLabel || c.parameter) === row.originalLabel &&
              c.value === row.value
          ) || {
            parameter: row.parameter,
            originalLabel: row.originalLabel,
            normalizedParameter: row.normalizedParameter,
            value: row.value,
            page: row.page,
            confidence: row.confidence,
            sourceText: row.sourceText,
            category: row.category,
            isCoreParameter: row.isCoreParameter,
          };
        return {
          ...base,
          validationStatus: row.validationStatus,
          validationPassed: row.validationStatus !== 'REJECT',
          validationReason: row.validationReason,
          validationRule: row.validationRule,
          validationConfidence: row.validationConfidence,
          isDynamicParameter: row.isDynamicParameter,
        };
      }),
      rejected: aliasValidation.rejected.map((row) => {
        const base =
          aliasNormalized.find(
            (c) =>
              c.page === row.page &&
              c.parameter === row.parameter &&
              c.value === row.value
          ) || ({
            parameter: row.parameter,
            originalLabel: row.originalLabel,
            value: row.value,
            page: row.page,
            confidence: row.confidence,
            sourceText: row.sourceText,
          } as TenderParameterCandidateRow);
        return {
          ...base,
          validationStatus: row.validationStatus,
          validationPassed: false,
          validationReason: row.validationReason,
          validationRule: row.validationRule,
          validationConfidence: row.validationConfidence,
          isDynamicParameter: row.isDynamicParameter,
        };
      }),
      rejectionLog: aliasValidation.rejected.map((row) => ({
        parameter: row.parameter,
        value: row.value,
        reason: row.validationReason,
        page: row.page,
        validationRule: row.validationRule,
        timestamp: new Date().toISOString(),
      })),
      stats: {
        inputCount: aliasValidation.stats.inputCount,
        validCount: aliasValidation.stats.validCount,
        reviewCount: aliasValidation.stats.reviewCount,
        dynamicCount: aliasValidation.stats.dynamicCount,
        rejectedCount: aliasValidation.stats.rejectedCount,
        rejectedByContext: 0,
        rejectedByDate: 0,
        rejectedByAmount: 0,
        rejectedByPeriod: 0,
        rejectedByLogic: 0,
      },
    };

    const rankingStats = aliasValidation.rankingStats;

    const tenderDoc = await TenderDocument.findById(documentId);
    const tenderId = tenderDoc?.tenderId ?? documentId;

    const discovery = await dynamicParameterDiscoveryService.discoverFromValidatedCandidates(
      documentId,
      tenderId,
      enterpriseValidation.storable,
      { serviceCategory: category, persist: true, tenderType }
    );

    const mapValidatedRow = (
      row: (typeof enterpriseValidation.storable)[0]
    ): TenderParameterCandidateRow => {
      const base =
        aliasNormalized.find(
          (c) =>
            c.page === row.page &&
            c.parameter === row.parameter &&
            c.value === row.value
        ) ||
        aliasNormalized.find(
          (c) =>
            c.page === row.page &&
            (c.originalLabel || c.parameter) === row.originalLabel &&
            c.value === row.value
        );
      return {
        ...(base || {
          parameter: row.parameter,
          originalLabel: row.originalLabel,
          normalizedParameter: row.normalizedParameter,
          value: row.value,
          page: row.page,
          confidence: row.confidence,
          sourceText: row.sourceText,
          category: row.category,
        }),
        validationStatus: row.validationStatus,
        validationPassed: row.validationStatus !== 'REJECT',
        validationReason: row.validationReason,
        validationRule: row.validationRule,
        validationConfidence: row.validationConfidence,
        isDynamicParameter: row.isDynamicParameter,
        isCoreParameter: row.isCoreParameter,
        rankWinner: true,
      };
    };

    const validatedRows = enterpriseValidation.storable.map(mapValidatedRow);

    const validationRejected = [
      ...enterpriseValidation.rejected,
      ...discovery.rejected.map((row) => ({ ...row, validationPassed: false as const, rankWinner: true })),
    ].map((row) => ({
      ...row,
      validationPassed: false as const,
      rankWinner: true,
    }));

    const processedKeys = new Set(
      [...validatedRows, ...validationRejected].map(
        (r) => `${r.page}|${r.parameter.toLowerCase()}|${r.value.toLowerCase()}`
      )
    );

    const unrankedRaw = aliasNormalized.filter(
      (r) => !processedKeys.has(`${r.page}|${r.parameter.toLowerCase()}|${r.value.toLowerCase()}`)
    );
    const recoveredUnranked = unrankedRaw
      .filter(
        (r) =>
          isGenuineTenderParameterRow(r) &&
          (rowResolvesAsCoreParameter(r) ||
            qualifiesForAdditionalTenderParameters({
              parameter: r.parameter,
              originalLabel: r.originalLabel,
              value: r.value,
              validationStatus: 'REVIEW',
              sourceText: r.sourceText,
              page: r.page,
            }))
      )
      .map((r) => ({
        ...r,
        validationPassed: true as const,
        rankWinner: true,
        rankReason: 'Preserved — genuine parameter recovered after ranking',
        validationStatus: 'REVIEW' as const,
        validationReason: 'Recovered unique parameter not in winner set',
        isDynamicParameter: !r.isCoreParameter,
      }));
    const rejectedUnranked = unrankedRaw
      .filter((r) => !isGenuineTenderParameterRow(r))
      .map((r) => ({
        ...r,
        validationPassed: false as const,
        rankWinner: false,
        rankReason: 'Duplicate candidate — lower priority row',
        validationStatus: 'REJECT' as const,
        validationReason: 'Duplicate extraction row not selected for master dataset',
      }));

    const allValidatedRows = [...validatedRows, ...recoveredUnranked];
    const finalCandidates = [...allValidatedRows, ...validationRejected, ...rejectedUnranked];

    await Promise.all(
      finalCandidates.map((row) =>
        TenderParameterCandidate.updateOne(
          {
            documentId,
            pageNumber: row.page,
            parameter: row.parameter,
            value: row.value,
          },
          {
            $set: {
              rankScore: row.rankScore ?? 0,
              rankReason: (row as { rankReason?: string }).rankReason || '',
              rankBreakdown: (row as { rankBreakdown?: Record<string, unknown> }).rankBreakdown ?? null,
              rankWinner: row.rankWinner ?? false,
              pagePriority: (row as { pagePriority?: number }).pagePriority ?? 0,
              sourceSection: (row as { sourceSection?: string }).sourceSection || '',
              priorityTier: (row as { priorityTier?: number }).priorityTier ?? 0,
              sectionName: (row as { sectionName?: string }).sectionName || '',
              sectionConfidence: (row as { sectionConfidence?: number }).sectionConfidence ?? 0,
              validationPassed: row.validationPassed ?? false,
              validationStatus: (row as { validationStatus?: string }).validationStatus || '',
              validationReason: row.validationReason || '',
              validationRule: row.validationRule || '',
              validationConfidence: (row as { validationConfidence?: number }).validationConfidence ?? row.confidence,
            },
          }
        )
      )
    );

    const validationStats = {
      inputCount: enterpriseValidation.stats.inputCount,
      validCount: allValidatedRows.length,
      rejectedCount: enterpriseValidation.stats.rejectedCount,
      rejectedByContext: enterpriseValidation.stats.rejectedByContext,
      rejectedByDate: enterpriseValidation.stats.rejectedByDate,
      rejectedByAmount: enterpriseValidation.stats.rejectedByAmount,
      rejectedByPeriod: enterpriseValidation.stats.rejectedByPeriod,
    };

    console.log('[CandidatePostProcessing] Rank + validate complete', {
      documentId: String(documentId),
      input: aliasNormalized.length,
      validated: allValidatedRows.length,
      rejected: validationStats.rejectedCount + rejectedUnranked.length,
    });

    return {
      candidates: allValidatedRows,
      rankingStats,
      validationStats,
    };
  }
}

export const tenderParameterCandidatePostProcessingService =
  new TenderParameterCandidatePostProcessingService();
