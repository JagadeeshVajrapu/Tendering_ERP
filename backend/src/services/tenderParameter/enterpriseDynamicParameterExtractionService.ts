import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from '../ocr/documentPageService';
import { ocrPageTextNormalizationService } from '../ocr/ocrPageTextNormalizationService';
import { tenderIntelligenceLayerService } from '../tenderIntelligence/tenderIntelligenceLayerService';
import {
  ENTERPRISE_DYNAMIC_EXTRACTION_MODEL,
  EnterpriseDynamicParameterExtractionResult,
  EnterpriseDynamicParameterRow,
  EnterpriseDynamicSectionExtractionInput,
} from '../../types/enterpriseDynamicParameterExtraction';
import {
  extractEnterpriseDynamicParameters,
  extractFromOcrInput,
} from './enterpriseDynamicParameterExtractionEngine';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';

class EnterpriseDynamicParameterExtractionService {
  async loadPages(documentId: Types.ObjectId) {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  private buildResult(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    originalName: string | undefined,
    tenderType: string,
    pagesScanned: number,
    engine: {
      parameters: EnterpriseDynamicParameterRow[];
      sectionResults: EnterpriseDynamicParameterExtractionResult['sectionResults'];
      aiUsed: boolean;
      aiModel?: string;
      chunksProcessed: number;
    }
  ): EnterpriseDynamicParameterExtractionResult {
    const knownParameterCount = engine.parameters.filter((p) => p.isCoreParameter).length;
    const unknownParameterCount = engine.parameters.length - knownParameterCount;

    return {
      documentId: String(documentId),
      tenderId: String(tenderId),
      tenderType,
      originalName,
      pagesScanned,
      sectionsProcessed: engine.sectionResults.length,
      chunksProcessed: engine.chunksProcessed,
      totalParameters: engine.parameters.length,
      knownParameterCount,
      unknownParameterCount,
      parameters: engine.parameters,
      sectionResults: engine.sectionResults,
      aiUsed: engine.aiUsed,
      aiModel: engine.aiModel ?? ENTERPRISE_DYNAMIC_EXTRACTION_MODEL,
      extractedAt: new Date().toISOString(),
    };
  }

  async extractFromSectionInput(
    input: EnterpriseDynamicSectionExtractionInput
  ): Promise<EnterpriseDynamicParameterRow[]> {
    return extractFromOcrInput(input);
  }

  async extractForDocument(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: {
      refresh?: boolean;
      maxPages?: number;
      aliasHints?: string;
      extraContext?: string;
      tenderType?: string;
      skipIntelligence?: boolean;
    }
  ): Promise<EnterpriseDynamicParameterExtractionResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    await ocrPageTextNormalizationService.ensureNormalized(documentId);
    const { pages: allPages } = await ocrPageTextNormalizationService.getCleanPagesForExtraction(documentId);
    if (!allPages.length) throw new AppError('No OCR pages available for dynamic parameter extraction', 400);

    const pages =
      opts?.maxPages && opts.maxPages > 0 ? allPages.slice(0, opts.maxPages) : allPages;

    let tenderType = opts?.tenderType || '';
    let sections = undefined as import('../../types/tenderIntelligenceLayer').TenderDocumentSection[] | undefined;

    if (!opts?.skipIntelligence) {
      const intelligence = await tenderIntelligenceLayerService.analyzeAndStore(
        documentId,
        tenderId,
        pages,
        { refresh: opts?.refresh }
      );
      tenderType = tenderType || intelligence.tenderType || 'Unclassified';
      sections = intelligence.sections;
    }

    const engine = await extractEnterpriseDynamicParameters(pages, {
      tenderType: tenderType || 'Unclassified',
      sections,
      aliasHints: opts?.aliasHints,
      extraContext: opts?.extraContext,
    });

    const parameters = engine.parameters.map((row) => ({
      ...row,
      isCoreParameter: row.isCoreParameter ?? isAllowedMasterParameter(row.parameter),
    }));

    return this.buildResult(documentId, tenderId, document.originalName, tenderType || 'Unclassified', pages.length, {
      ...engine,
      parameters,
    });
  }

  async getExtraction(documentId: string, refresh = false): Promise<EnterpriseDynamicParameterExtractionResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    return this.extractForDocument(document._id, document.tenderId, { refresh });
  }
}

export const enterpriseDynamicParameterExtractionService =
  new EnterpriseDynamicParameterExtractionService();
