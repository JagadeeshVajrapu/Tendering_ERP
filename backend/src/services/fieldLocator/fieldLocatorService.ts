import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { DocumentLocatorField } from '../../models/DocumentLocatorField';
import { documentPageService } from '../ocr/documentPageService';
import { fieldLocatorEngine } from './fieldLocatorEngine';
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { FIELD_LOCATOR_FIELD_ORDER } from './fieldLocatorRegistry';
import { FieldLocatorEngineResult, FieldLocatorResult } from '../../types/fieldLocator';
import { ParameterDiscoveryResult } from '../../types/parameterDiscovery';
import { isFieldLocatorDebugMode } from './fieldLocatorOptions';
import { MappedBusinessField } from '../../types/parameterMapping';
import { tenderProductionPipeline } from '../production/tenderProductionPipeline';

export interface FieldLocatorDebugResponse extends FieldLocatorEngineResult {
  documentId: string;
  tenderId: string;
  originalName?: string;
  matchMethods: string[];
  discoveredParameters?: ParameterDiscoveryResult;
  parameterMappings?: MappedBusinessField[];
  debugMode: boolean;
}

class FieldLocatorService {
  async loadAllPages(documentId: Types.ObjectId) {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  async saveResults(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    result: FieldLocatorEngineResult
  ): Promise<void> {
    await DocumentLocatorField.deleteMany({ documentId });
    if (!result.fields.length) return;

    await DocumentLocatorField.insertMany(
      result.fields.map((f) => ({
        documentId,
        tenderId,
        fieldName: f.fieldName,
        value: f.value,
        sourcePage: f.sourcePage,
        sourceText: f.sourceText,
        extractionMethod: f.extractionMethod,
        confidence: f.confidence,
      }))
    );
  }

  async getFieldsDebug(documentId: string): Promise<FieldLocatorDebugResponse> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const pageTexts = await this.loadAllPages(document._id);
    if (!pageTexts.length) {
      throw new AppError(
        'No OCR pages found. Upload the document and wait for OCR to finish before field extraction.',
        400
      );
    }

    const debugMode = isFieldLocatorDebugMode({ debugMode: true });

    const production = await tenderProductionPipeline.run({
      documentId: document._id,
      tenderId: document.tenderId,
      pages: pageTexts,
    });

    const discovery = production.discoveredParameters;

    const result: FieldLocatorEngineResult = {
      pagesSearched: pageTexts.length,
      priorityPages: Math.min(5, pageTexts.length),
      fields: production.fields,
      foundCount: production.fields.length,
      missingFields: FIELD_LOCATOR_FIELD_ORDER.filter(
        (name) => !production.fields.some((f) => f.fieldName === name)
      ),
      failedFields: debugMode ? fieldLocatorEngine.locate(pageTexts, { debugMode: true }).failedFields : [],
    };

    await this.saveResults(document._id, document.tenderId, result);

    await masterDatasetService.buildAndStore({
      tenderId: document.tenderId,
      documentId: document._id,
    });

    return {
      documentId: String(document._id),
      tenderId: String(document.tenderId),
      originalName: document.originalName,
      pagesSearched: result.pagesSearched,
      priorityPages: result.priorityPages,
      fields: result.fields,
      foundCount: result.foundCount,
      missingFields: result.missingFields,
      failedFields: result.failedFields,
      matchMethods: ['regex', 'keyword', 'alias'],
      discoveredParameters: discovery,
      parameterMappings: production.mappedFields,
      debugMode,
    };
  }

  async getStoredFields(documentId: Types.ObjectId) {
    return DocumentLocatorField.find({ documentId }).sort({
      fieldName: 1,
    });
  }
}

export const fieldLocatorService = new FieldLocatorService();
export { FIELD_LOCATOR_FIELD_ORDER };
