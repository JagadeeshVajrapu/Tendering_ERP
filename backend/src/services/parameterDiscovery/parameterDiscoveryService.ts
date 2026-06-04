import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from '../ocr/documentPageService';
import { ocrNormalizationService } from '../ocr/ocrNormalizationService';
import { ParameterDiscoveryResult } from '../../types/parameterDiscovery';
import {
  buildDynamicParameterEngineResult,
  persistDynamicParameters,
} from './dynamicParameterEngine';
import { classifyParameterGroup, groupDiscoveredParameters } from './parameterGroupingEngine';
import { DiscoveredParameter } from '../../types/parameterDiscovery';
import { DynamicParameterEngineResult } from '../../types/dynamicParameter';

class ParameterDiscoveryService {
  async loadAllPages(documentId: Types.ObjectId) {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  private toLegacyResult(engine: DynamicParameterEngineResult): ParameterDiscoveryResult {
    const parameters: DiscoveredParameter[] = engine.parameters.map((p) => ({
      parameterName: p.parameterName,
      parameterValue: p.parameterValue,
      pageNumber: p.sourcePage,
      sourceText: `${p.parameterName}: ${p.parameterValue}`,
      confidence: p.confidence,
      category: classifyParameterGroup(p.parameterName, p.parameterValue),
    }));

    return {
      documentId: engine.documentId,
      tenderId: engine.tenderId,
      pagesScanned: engine.pagesScanned,
      totalFound: engine.totalFound,
      parameters,
      grouped: groupDiscoveredParameters(parameters),
    };
  }

  async discoverAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { maxPage?: number | null }
  ) {
    const pageTexts = await this.loadAllPages(documentId);
    const normalization = await ocrNormalizationService.normalizeAndStore(
      documentId,
      tenderId,
      pageTexts
    );
    ocrNormalizationService.assertNormalizationReady(normalization);

    const engine = buildDynamicParameterEngineResult(
      String(documentId),
      String(tenderId),
      pageTexts,
      { maxPage: opts?.maxPage ?? null, normalizedRecords: normalization.records }
    );
    await persistDynamicParameters(documentId, tenderId, engine.parameters);
    return this.toLegacyResult(engine);
  }

  async getDiscoveredParameters(
    documentId: string,
    refresh = false
  ): Promise<ParameterDiscoveryResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (!refresh) {
      const { DocumentDiscoveredParameter } = await import('../../models/DocumentDiscoveredParameter');
      const stored = await DocumentDiscoveredParameter.find({ documentId: document._id }).sort({
        pageNumber: 1,
        parameterName: 1,
      });

      if (stored.length) {
        const { classifyParameterGroup } = await import('./parameterGroupingEngine');
        const parameters: DiscoveredParameter[] = stored.map((p) => ({
            parameterName: p.parameterName,
            parameterValue: p.parameterValue,
            pageNumber: p.pageNumber,
            sourceText: p.sourceText,
            confidence: p.confidence,
            category: classifyParameterGroup(p.parameterName, p.parameterValue),
          }));

        const pageCount = await DocumentPage.countDocuments({ documentId: document._id });

        return {
          documentId: String(document._id),
          tenderId: String(document.tenderId),
          pagesScanned: pageCount,
          totalFound: parameters.length,
          parameters,
          grouped: groupDiscoveredParameters(parameters),
        };
      }
    }

    return this.discoverAndStore(document._id, document.tenderId, { maxPage: null });
  }

  /** Direct engine output for NIT / production UI. */
  async runEngineForDocument(documentId: Types.ObjectId, tenderId: Types.ObjectId, refresh = false) {
    if (!refresh) {
      const { DocumentDiscoveredParameter } = await import('../../models/DocumentDiscoveredParameter');
      const count = await DocumentDiscoveredParameter.countDocuments({ documentId });
      if (count > 0) {
        const pageTexts = await this.loadAllPages(documentId);
        const pagesScanned = pageTexts.length;
        const stored = await DocumentDiscoveredParameter.find({ documentId }).sort({
          pageNumber: 1,
          parameterName: 1,
        });
        return {
          documentId: String(documentId),
          tenderId: String(tenderId),
          pagesScanned,
          totalFound: stored.length,
          parameters: stored.map((p) => ({
            parameterName: p.parameterName,
            parameterValue: p.parameterValue,
            sourcePage: p.pageNumber,
            confidence: p.confidence,
          })),
        };
      }
    }

    const pageTexts = await this.loadAllPages(documentId);
    const normalization = await ocrNormalizationService.normalizeAndStore(
      documentId,
      tenderId,
      pageTexts
    );
    ocrNormalizationService.assertNormalizationReady(normalization);

    const engine = buildDynamicParameterEngineResult(
      String(documentId),
      String(tenderId),
      pageTexts,
      { maxPage: null, normalizedRecords: normalization.records }
    );
    await persistDynamicParameters(documentId, tenderId, engine.parameters);
    return engine;
  }
}

export const parameterDiscoveryService = new ParameterDiscoveryService();
