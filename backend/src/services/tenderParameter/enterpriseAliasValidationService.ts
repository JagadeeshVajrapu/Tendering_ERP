import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from '../ocr/documentPageService';
import { EnterpriseAliasValidationResult } from '../../types/enterpriseAliasValidation';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import {
  getEnterpriseAliasValidationRegistry,
  processEnterpriseAliasAndValidation,
} from './enterpriseAliasValidationEngine';

class EnterpriseAliasValidationService {
  async getDashboard(documentId: string, refresh = false): Promise<EnterpriseAliasValidationResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const stored = await TenderParameterCandidate.find({ documentId: document._id })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();

    if (!stored.length) {
      throw new AppError('No parameter candidates found. Run extraction first.', 404);
    }

    const pages = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
    const pageTexts = documentPageService.toPageText(pages);

    const rawCandidates = stored.map((s) => ({
      parameter: s.originalLabel || s.parameter,
      value: s.value,
      page: s.pageNumber,
      confidence: s.confidence,
      sourceText: s.sourceText,
      category: s.category,
      isCoreParameter: s.isCoreParameter,
    }));

    const serviceCategory = (document.serviceCategory || '') as TenderServiceCategory | '';
    const result = processEnterpriseAliasAndValidation(rawCandidates, {
      serviceCategory,
      pageTexts,
      skipRanking: refresh,
    });

    const parameters = [...result.validated, ...result.rejected].sort(
      (a, b) => a.page - b.page || a.parameter.localeCompare(b.parameter)
    );

    return {
      documentId: String(document._id),
      tenderId: String(document.tenderId),
      serviceCategory: serviceCategory || undefined,
      aliasExamples: result.aliasExamples,
      parameters,
      stats: result.stats,
      processedAt: new Date().toISOString(),
    };
  }

  getRegistry() {
    return getEnterpriseAliasValidationRegistry();
  }
}

export const enterpriseAliasValidationService = new EnterpriseAliasValidationService();
