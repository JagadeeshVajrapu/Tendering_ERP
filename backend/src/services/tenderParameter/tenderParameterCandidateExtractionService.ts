import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { documentPageService } from '../ocr/documentPageService';
import { ocrPageTextNormalizationService } from '../ocr/ocrPageTextNormalizationService';
import {
  STEP1_CANDIDATE_AI_MODEL,
  TenderParameterCandidateExtractionResult,
  TenderParameterCandidateRow,
} from '../../types/tenderParameterCandidateExtraction';
import {
  CANDIDATE_EXTRACTION_CHUNK_SIZE,
  extractTenderParameterCandidates,
} from './tenderParameterCandidateExtractionEngine';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { tenderParameterCandidatePostProcessingService } from './tenderParameterCandidatePostProcessingService';
import { aiExtractionDebugService } from './aiExtractionDebugService';
import {
  formatAliasDictionaryForExtractionPrompt,
  normalizeCandidatesWithAliasDictionary,
} from './enterpriseAliasDictionaryEngine';
import { resolveTenderTypeLibraryParameter } from '../tenderIntelligence/enterpriseTenderTypeLibraryEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import { isGenuineTenderParameterRow } from './tenderParameterQualityEngine';
import { tenderTypeIntelligenceService } from '../tenderIntelligence/tenderTypeIntelligenceService';
import { tenderIntelligenceLayerService } from '../tenderIntelligence/tenderIntelligenceLayerService';
import { enterpriseSectionDetectionService } from '../tenderIntelligence/enterpriseSectionDetectionService';
import { filterCandidatesBySection } from '../tenderIntelligence/enterpriseSectionCandidateValidator';

const inflightByDocument = new Map<string, Promise<TenderParameterCandidateExtractionResult>>();

function toCandidateRow(row: {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  category?: string;
  isCoreParameter?: boolean;
  pagePriority?: number;
  priorityTier?: number;
  sourceSection?: string;
}): TenderParameterCandidateRow {
  return {
    parameter: row.parameter,
    originalLabel: row.parameter,
    normalizedParameter: row.parameter,
    value: row.value,
    page: row.page,
    confidence: row.confidence,
    sourceText: row.sourceText,
    category: row.category,
    isCoreParameter: row.isCoreParameter,
    pagePriority: row.pagePriority,
    priorityTier: row.priorityTier,
    sourceSection: row.sourceSection,
  };
}

class TenderParameterCandidateExtractionService {
  async loadPages(documentId: Types.ObjectId) {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  private mapStored(row: {
    parameter: string;
    originalLabel?: string;
    canonicalKey?: string;
    normalizedParameter?: string;
    category?: string;
    isCoreParameter?: boolean;
    aliasMatchScore?: number;
    aliasMatchMethod?: string;
    value: string;
    pageNumber: number;
    pagePriority?: number;
    sourceSection?: string;
    priorityTier?: number;
    sectionName?: string;
    sectionConfidence?: number;
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
      normalizedParameter: row.normalizedParameter || row.parameter,
      category: row.category,
      isCoreParameter: row.isCoreParameter,
      aliasMatchScore: row.aliasMatchScore,
      aliasMatchMethod: row.aliasMatchMethod as TenderParameterCandidateRow['aliasMatchMethod'],
      value: row.value,
      page: row.pageNumber,
      pagePriority: row.pagePriority,
      sourceSection: row.sourceSection,
      priorityTier: row.priorityTier,
      sectionName: row.sectionName,
      sectionConfidence: row.sectionConfidence,
      confidence: row.confidence,
      sourceText: row.sourceText,
      rankScore: row.rankScore,
      rankWinner: row.rankWinner ?? undefined,
      validationPassed: row.validationPassed,
      validationReason: row.validationReason,
      validationRule: row.validationRule,
    };
  }

  private toResult(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    originalName: string | undefined,
    pagesScanned: number,
    engine: {
      candidates: TenderParameterCandidateRow[];
      aiUsed: boolean;
      aiModel?: string;
      chunksProcessed: number;
      rankingStats?: TenderParameterCandidateExtractionResult['rankingStats'];
      validationStats?: TenderParameterCandidateExtractionResult['validationStats'];
    }
  ): TenderParameterCandidateExtractionResult {
    return {
      documentId: String(documentId),
      tenderId: String(tenderId),
      originalName,
      pagesScanned,
      chunkSize: CANDIDATE_EXTRACTION_CHUNK_SIZE,
      chunksProcessed: engine.chunksProcessed,
      totalCandidates: engine.candidates.length,
      candidates: engine.candidates,
      rankingStats: engine.rankingStats,
      validationStats: engine.validationStats,
      aiUsed: engine.aiUsed,
      aiModel: engine.aiModel ?? STEP1_CANDIDATE_AI_MODEL,
      extractedAt: new Date().toISOString(),
    };
  }

  async persistCandidates(
    documentId: Types.ObjectId,
    candidates: TenderParameterCandidateRow[],
    aiModel: string
  ): Promise<void> {
    await TenderParameterCandidate.deleteMany({ documentId });
    if (!candidates.length) return;

    await TenderParameterCandidate.insertMany(
      candidates.map((c) => ({
        documentId,
        parameter: c.parameter,
        originalLabel: c.originalLabel || c.parameter,
        normalizedParameter: c.normalizedParameter || c.parameter,
        canonicalKey: c.canonicalKey || '',
        category: c.category || '',
        aliasMatchScore: 0,
        aliasMatchMethod: '',
        isCoreParameter: c.isCoreParameter ?? false,
        value: c.value,
        pageNumber: c.page,
        pagePriority: c.pagePriority ?? 0,
        sourceSection: c.sourceSection || '',
        priorityTier: c.priorityTier ?? 0,
        sectionName: c.sectionName || '',
        sectionConfidence: c.sectionConfidence ?? 0,
        confidence: c.confidence,
        sourceText: c.sourceText,
        aiModel,
        rankScore: 0,
        rankWinner: null,
        validationPassed: null,
        validationReason: '',
        validationRule: '',
      }))
    );
  }

  /**
   * AI Tender Parameter Discovery & Extraction — OCR text → Gemini/OpenAI → parameter candidates.
   * Candidate extraction only. No ranking. No validation.
   */
  async extractAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: {
      refresh?: boolean;
      maxPages?: number;
      onExtractionProgress?: (completed: number, total: number) => void | Promise<void>;
    }
  ): Promise<TenderParameterCandidateExtractionResult> {
    const docKey = String(documentId);
    if (!opts?.refresh && inflightByDocument.has(docKey)) {
      return inflightByDocument.get(docKey)!;
    }

    const run = this.runExtraction(documentId, tenderId, opts);
    if (!opts?.refresh) inflightByDocument.set(docKey, run);
    try {
      return await run;
    } finally {
      inflightByDocument.delete(docKey);
    }
  }

  /**
   * Ranking + validation — separate pipeline step after raw extraction.
   */
  async rankAndValidate(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages?: import('../../types/intelligence').PageText[],
    serviceCategory?: TenderServiceCategory | ''
  ): Promise<TenderParameterCandidateExtractionResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const pageCount = pages?.length ?? (await DocumentPage.countDocuments({ documentId }));
    const post = await tenderParameterCandidatePostProcessingService.rankAndValidate(
      documentId,
      pages,
      serviceCategory
    );

    return this.toResult(documentId, tenderId, document.originalName, pageCount, {
      candidates: post.candidates,
      aiUsed: true,
      chunksProcessed: Math.ceil(pageCount / CANDIDATE_EXTRACTION_CHUNK_SIZE) || 1,
      rankingStats: post.rankingStats,
      validationStats: post.validationStats,
    });
  }

  private async runExtraction(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: {
      refresh?: boolean;
      maxPages?: number;
      onExtractionProgress?: (completed: number, total: number) => void | Promise<void>;
    }
  ): Promise<TenderParameterCandidateExtractionResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    await ocrPageTextNormalizationService.ensureNormalized(documentId);
    const { pages: allPages } = await ocrPageTextNormalizationService.getCleanPagesForExtraction(documentId);
    if (!allPages.length) throw new AppError('No OCR pages available for candidate extraction', 400);

    const pages =
      opts?.maxPages && opts.maxPages > 0 ? allPages.slice(0, opts.maxPages) : allPages;

    if (!opts?.refresh && !opts?.maxPages) {
      const stored = await TenderParameterCandidate.find({ documentId })
        .sort({ pageNumber: 1, parameter: 1 })
        .lean();
      if (stored.length) {
        const chunkCount = Math.ceil(allPages.length / CANDIDATE_EXTRACTION_CHUNK_SIZE) || 1;
        return this.toResult(documentId, tenderId, document.originalName, allPages.length, {
          candidates: stored.map((s) => this.mapStored(s)),
          aiUsed: true,
          aiModel: stored[0]?.aiModel ?? STEP1_CANDIDATE_AI_MODEL,
          chunksProcessed: chunkCount,
        });
      }
    }

    const totalChunks = Math.ceil(pages.length / CANDIDATE_EXTRACTION_CHUNK_SIZE) || 1;
    let completedChunks = 0;

    const typeIntel = await tenderTypeIntelligenceService.analyzeAndStore(
      documentId,
      tenderId,
      pages,
      { refresh: opts?.refresh }
    );

    const sectionIntel = await enterpriseSectionDetectionService.analyzeAndStore(
      documentId,
      tenderId,
      pages,
      { refresh: opts?.refresh }
    );

    const sectionContext = enterpriseSectionDetectionService.buildExtractionContext(sectionIntel);

    const serviceCategory =
      tenderIntelligenceLayerService.mapTenderTypeToServiceCategory(typeIntel.tenderType) || '';

    const extraction = await extractTenderParameterCandidates(pages, {
      aliasHints: [typeIntel.aliasHintsText, formatAliasDictionaryForExtractionPrompt()].filter(Boolean).join('\n\n'),
      serviceContext: `${typeIntel.extractionContext}\n\n${sectionContext}`,
      pageClassifications: sectionIntel.pageClassifications.map((p) => ({
        page: p.page,
        sections: p.sections.map((s) => ({ section: s.section, confidence: s.confidence })),
      })),
      metadata: {
        documentName: document.originalName,
        tenderTitle: document.originalName,
        tenderType: typeIntel.tenderType || undefined,
        intelligenceConfidence: typeIntel.confidence,
        serviceCategory: serviceCategory || undefined,
        documentSections: sectionIntel.documentSections.map((s) => ({
          section: s.section,
          confidence: s.confidence,
          startPage: s.startPage,
          endPage: s.endPage,
        })),
      },
    });

    completedChunks = extraction.chunksProcessed;
    await opts?.onExtractionProgress?.(completedChunks, totalChunks);

    const {
      candidates: aliasMappedRaw,
      aliasStats,
      duplicateMerge,
    } = normalizeCandidatesWithAliasDictionary(extraction.candidates.map(toCandidateRow), {
      serviceCategory,
      tenderType: typeIntel.tenderType || '',
    });

    const aliasMapped = aliasMappedRaw.map((row) => {
      if (!typeIntel.tenderType) return row;
      const resolved = resolveTenderTypeLibraryParameter(row.parameter, typeIntel.tenderType);
      if (!resolved.matched) return row;
      return {
        ...row,
        parameter: resolved.standardParameter,
        normalizedParameter: resolved.standardParameter,
        aliasMapped: true,
      };
    });

    const qualityFiltered = aliasMapped.filter(
      (row) =>
        isAllowedMasterParameter(row.parameter, row.canonicalKey) ||
        row.isCoreParameter ||
        isGenuineTenderParameterRow(row)
    );

    const { accepted: candidates, rejected: sectionRejected } = filterCandidatesBySection(
      qualityFiltered,
      sectionIntel.pageClassifications
    );

    if (sectionRejected.length) {
      console.log('[CandidateExtraction] Section-filtered candidates', {
        documentId: String(documentId),
        accepted: candidates.length,
        sectionRejected: sectionRejected.length,
        samples: sectionRejected.slice(0, 5).map((r) => ({
          parameter: r.parameter,
          page: r.page,
          reason: r.sectionRejectReason,
        })),
      });
    }

    const aiModel = extraction.aiModel ?? STEP1_CANDIDATE_AI_MODEL;

    await this.persistCandidates(documentId, candidates, aiModel);
    await aiExtractionDebugService.persistSnapshot(documentId, tenderId, candidates, aiModel);

    console.log('[CandidateExtraction] Stored parameter candidates', {
      documentId: String(documentId),
      tenderType: typeIntel.tenderType || 'unclassified',
      tenderTypeConfidence: typeIntel.confidence,
      typeSpecificParameters: typeIntel.profile.parameters.length,
      libraryLoaded: typeIntel.library.libraryLoaded,
      librarySearchParameters: typeIntel.library.searchParameters.length,
      extracted: extraction.candidates.length,
      aliasMatched: aliasStats.aliasMatchedCount,
      duplicateMerged: duplicateMerge.removedDuplicates,
      afterFilter: candidates.length,
      pagesScanned: pages.length,
      chunksProcessed: extraction.chunksProcessed,
      aiModel,
      aiUsed: extraction.aiUsed,
    });

    return this.toResult(documentId, tenderId, document.originalName, pages.length, {
      candidates,
      aiUsed: extraction.aiUsed,
      aiModel,
      chunksProcessed: extraction.chunksProcessed,
    });
  }

  async getCandidates(documentId: string, refresh = false): Promise<TenderParameterCandidateExtractionResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (refresh) return this.extractAndStore(document._id, document.tenderId, { refresh: true });

    const stored = await TenderParameterCandidate.find({ documentId: document._id })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();

    if (stored.length) {
      const pageCount = await DocumentPage.countDocuments({ documentId: document._id });
      const chunkCount = Math.ceil(pageCount / CANDIDATE_EXTRACTION_CHUNK_SIZE) || 1;
      return this.toResult(document._id, document.tenderId, document.originalName, pageCount, {
        candidates: stored.map((s) => this.mapStored(s)),
        aiUsed: true,
        aiModel: stored[0]?.aiModel ?? STEP1_CANDIDATE_AI_MODEL,
        chunksProcessed: chunkCount,
      });
    }

    return this.extractAndStore(document._id, document.tenderId);
  }
}

export const tenderParameterCandidateExtractionService = new TenderParameterCandidateExtractionService();
