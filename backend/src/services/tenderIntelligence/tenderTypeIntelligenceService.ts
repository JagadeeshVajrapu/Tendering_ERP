import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { PageText } from '../../types/intelligence';
import { TenderTypeIntelligenceResult } from '../../types/tenderTypeIntelligence';
import { TenderIntelligenceLayer } from '../../models/TenderIntelligenceLayer';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { ocrPageTextNormalizationService } from '../ocr/ocrPageTextNormalizationService';
import {
  analyzeTenderTypeIntelligence,
  buildTenderTypeExtractionContext,
  formatAliasHints,
  getTenderTypeIntelligenceRuleSummary,
} from './tenderTypeIntelligenceEngine';
import { getTenderTypeProfile } from './tenderTypeIntelligenceKnowledgeBase';
import { buildTenderTypeLibraryContext, loadTenderTypeLibrary } from './enterpriseTenderTypeLibraryEngine';
import { analyzeTenderIntelligence } from './tenderIntelligenceLayerEngine';

class TenderTypeIntelligenceService {
  async loadCleanPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const { pages } = await ocrPageTextNormalizationService.getCleanPagesForExtraction(documentId);
    return pages;
  }

  analyzeFromPages(pages: PageText[]): TenderTypeIntelligenceResult {
    return analyzeTenderTypeIntelligence(pages);
  }

  async analyzeAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages?: PageText[],
    opts?: { refresh?: boolean }
  ): Promise<TenderTypeIntelligenceResult & { documentId: string; tenderId: string; pagesScanned: number }> {
    if (!opts?.refresh) {
      const existing = await TenderIntelligenceLayer.findOne({ documentId }).lean();
      if (existing?.tenderType) {
        const profile = getTenderTypeProfile(existing.tenderType);
        const library = loadTenderTypeLibrary(existing.tenderType);
        const libraryContext = buildTenderTypeLibraryContext(existing.tenderType, existing.confidence);
        return {
          tenderType: profile.tenderType,
          confidence: existing.confidence,
          typeScores: (existing.typeScores as Record<string, number>) || {},
          matchedKeywords: [],
          profile,
          library,
          extractionContext: `${buildTenderTypeExtractionContext(
            existing.tenderType,
            existing.confidence,
            profile
          )}\n\n${libraryContext}`,
          libraryContext,
          aliasHintsText: formatAliasHints(profile),
          documentId: String(documentId),
          tenderId: String(tenderId),
          pagesScanned: existing.pagesScanned,
        };
      }
    }

    const pageList = pages?.length ? pages : await this.loadCleanPages(documentId);
    if (!pageList.length) throw new AppError('No OCR pages available for tender type intelligence', 400);

    const typeIntel = this.analyzeFromPages(pageList);
    const sectionAnalysis = analyzeTenderIntelligence(pageList);

    await TenderIntelligenceLayer.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        tenderType: typeIntel.tenderType || sectionAnalysis.tenderType,
        confidence: typeIntel.confidence || sectionAnalysis.confidence,
        sections: sectionAnalysis.sections,
        typeScores: typeIntel.typeScores,
        pagesScanned: pageList.length,
        analyzedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log('[TenderTypeIntelligence] Detected', {
      documentId: String(documentId),
      tenderType: typeIntel.tenderType || 'unclassified',
      confidence: typeIntel.confidence,
      parameters: typeIntel.profile.parameters.length,
      rules: typeIntel.profile.rules.length,
      aliases: typeIntel.profile.aliases.length,
    });

    return {
      ...typeIntel,
      documentId: String(documentId),
      tenderId: String(tenderId),
      pagesScanned: pageList.length,
    };
  }

  async getForDocument(
    documentId: string,
    refresh = false
  ): Promise<TenderTypeIntelligenceResult & { documentId: string; tenderId: string; pagesScanned: number }> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const pageCount = await DocumentPage.countDocuments({ documentId: document._id });
    if (!pageCount) throw new AppError('No OCR pages available', 400);

    return this.analyzeAndStore(document._id, document.tenderId, undefined, { refresh });
  }

  getRuleSummary() {
    return getTenderTypeIntelligenceRuleSummary();
  }
}

export const tenderTypeIntelligenceService = new TenderTypeIntelligenceService();
