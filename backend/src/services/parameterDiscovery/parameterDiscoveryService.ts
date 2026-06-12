import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from '../ocr/documentPageService';
import { ParameterDiscoveryResult } from '../../types/parameterDiscovery';
import { persistDynamicParameters } from './dynamicParameterEngine';
import { buildValidatedMasterDatasetParameters } from '../masterTenderDataset/validatedMasterDatasetBuilder';
import { validatedMasterDatasetService } from '../masterTenderDataset/validatedMasterDatasetService';
import { tenderParameterCandidateExtractionService } from '../tenderParameter/tenderParameterCandidateExtractionService';
import { classifyParameterGroup, groupDiscoveredParameters } from './parameterGroupingEngine';
import { DiscoveredParameter } from '../../types/parameterDiscovery';
import { passesExtendedTenderParameterQuality } from '../tenderParameter/tenderParameterQualityEngine';

class ParameterDiscoveryService {
  async loadAllPages(documentId: Types.ObjectId) {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  private mapValidatedParameters(
    documentId: string,
    tenderId: string,
    pageCount: number,
    validated: ReturnType<typeof buildValidatedMasterDatasetParameters>
  ): ParameterDiscoveryResult {
    const parameters: DiscoveredParameter[] = validated.map((p) => ({
      parameterName: p.parameter,
      parameterValue: p.value,
      pageNumber: p.page,
      sourceText: p.sourceText,
      confidence: p.confidence,
      category: classifyParameterGroup(p.parameter, p.value),
    }));

    return {
      documentId,
      tenderId,
      pagesScanned: pageCount,
      totalFound: parameters.length,
      parameters,
      grouped: groupDiscoveredParameters(parameters),
    };
  }

  private filterAllowedStored(
    stored: Array<{
      parameterName: string;
      parameterValue: string;
      pageNumber: number;
      sourceText?: string;
      confidence: number;
    }>
  ): DiscoveredParameter[] {
    return stored
      .filter((p) =>
        passesExtendedTenderParameterQuality({
          parameter: p.parameterName,
          originalLabel: p.parameterName,
          value: p.parameterValue,
          page: p.pageNumber,
          confidence: p.confidence,
          sourceText: p.sourceText || `${p.parameterName}: ${p.parameterValue}`,
        })
      )
      .map((p) => ({
        parameterName: p.parameterName,
        parameterValue: p.parameterValue,
        pageNumber: p.pageNumber,
        sourceText: p.sourceText || `${p.parameterName}: ${p.parameterValue}`,
        confidence: p.confidence,
        category: classifyParameterGroup(p.parameterName, p.parameterValue),
      }));
  }

  async discoverAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    _opts?: { maxPage?: number | null }
  ): Promise<ParameterDiscoveryResult> {
    const pageTexts = await this.loadAllPages(documentId);
    const pageCount = pageTexts.length;

    await tenderParameterCandidateExtractionService.extractAndStore(documentId, tenderId);
    await validatedMasterDatasetService.buildAndStore(documentId, tenderId);
    const validated = buildValidatedMasterDatasetParameters(
      await validatedMasterDatasetService.loadValidatedCandidates(documentId)
    );

    const result = this.mapValidatedParameters(
      String(documentId),
      String(tenderId),
      pageCount,
      validated
    );

    await persistDynamicParameters(
      documentId,
      tenderId,
      result.parameters.map((p) => ({
        parameterName: p.parameterName,
        parameterValue: p.parameterValue,
        sourcePage: p.pageNumber,
        confidence: p.confidence,
      }))
    );

    return result;
  }

  async getDiscoveredParameters(
    documentId: string,
    refresh = false
  ): Promise<ParameterDiscoveryResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const pageCount = await DocumentPage.countDocuments({ documentId: document._id });

    if (!refresh) {
      const master = await validatedMasterDatasetService.getByDocumentId(document._id);
      if (master?.parameters.length) {
        const validated = buildValidatedMasterDatasetParameters(
          await validatedMasterDatasetService.loadValidatedCandidates(document._id)
        );
        return this.mapValidatedParameters(
          String(document._id),
          String(document.tenderId),
          pageCount,
          validated
        );
      }

      const { DocumentDiscoveredParameter } = await import('../../models/DocumentDiscoveredParameter');
      const stored = await DocumentDiscoveredParameter.find({ documentId: document._id }).sort({
        pageNumber: 1,
        parameterName: 1,
      });

      const allowed = this.filterAllowedStored(stored);
      if (allowed.length) {
        return {
          documentId: String(document._id),
          tenderId: String(document.tenderId),
          pagesScanned: pageCount,
          totalFound: allowed.length,
          parameters: allowed,
          grouped: groupDiscoveredParameters(allowed),
        };
      }
    }

    return this.discoverAndStore(document._id, document.tenderId);
  }

  /** Direct engine output for NIT / production UI. */
  async runEngineForDocument(documentId: Types.ObjectId, tenderId: Types.ObjectId, refresh = false) {
    const result = await this.getDiscoveredParameters(String(documentId), refresh);
    return {
      documentId: result.documentId,
      tenderId: result.tenderId,
      pagesScanned: result.pagesScanned,
      totalFound: result.totalFound,
      parameters: result.parameters.map((p) => ({
        parameterName: p.parameterName,
        parameterValue: p.parameterValue,
        sourcePage: p.pageNumber,
        confidence: p.confidence,
      })),
    };
  }
}

export const parameterDiscoveryService = new ParameterDiscoveryService();
