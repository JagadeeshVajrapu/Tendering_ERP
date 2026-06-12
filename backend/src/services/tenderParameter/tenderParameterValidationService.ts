import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from '../ocr/documentPageService';
import { applyEnterpriseAliasToCandidates } from './enterpriseTenderAliasEngine';
import { rankEnterpriseTenderParameterCandidates } from './enterpriseTenderCandidateRankingEngine';
import { validateEnterpriseTenderCandidates, getEnterpriseValidationRuleSummary } from './enterpriseTenderValidationEngine';
import { partitionCoreAndDynamicCandidates } from './tenderParameterCandidatePartition';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';

class TenderParameterValidationService {
  async getValidationDashboard(documentId: string) {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const stored = await TenderParameterCandidate.find({ documentId: document._id })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();

    if (!stored.length) throw new AppError('No parameter candidates found', 404);

    const pages = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
    const pageTexts = documentPageService.toPageText(pages);

    const rawRows = stored.map((s) => ({
      parameter: s.originalLabel || s.parameter,
      value: s.value,
      page: s.pageNumber,
      confidence: s.confidence,
      sourceText: s.sourceText,
      category: s.category,
      isCoreParameter: s.isCoreParameter,
      canonicalKey: s.canonicalKey,
      rankScore: s.rankScore,
      aliasMatchScore: s.aliasMatchScore,
    }));

    const serviceCategory = (document.serviceCategory || '') as TenderServiceCategory | '';
    const { candidates: aliasNormalized } = applyEnterpriseAliasToCandidates(rawRows, { serviceCategory });
    const { core, dynamic } = partitionCoreAndDynamicCandidates(aliasNormalized);
    const rankedCore = rankEnterpriseTenderParameterCandidates(core, pageTexts);
    const rankedDynamic = rankEnterpriseTenderParameterCandidates(dynamic, pageTexts);
    const allWinners = [...rankedCore.winners, ...rankedDynamic.winners];

    const validation = validateEnterpriseTenderCandidates(allWinners, { allCandidates: aliasNormalized });

    const extractedParameters = stored.map((s) => ({
      parameter: s.parameter,
      originalLabel: s.originalLabel,
      value: s.value,
      page: s.pageNumber,
      confidence: s.confidence,
      rankScore: s.rankScore,
      rankWinner: s.rankWinner,
      validationStatus: s.validationStatus || (s.validationPassed === false ? 'REJECT' : s.validationPassed ? 'VALID' : 'PENDING'),
      validationReason: s.validationReason,
    }));

    return {
      documentId,
      stats: validation.stats,
      extractedParameters,
      validatedParameters: validation.storable.map((r) => ({
        parameter: r.parameter,
        value: r.value,
        page: r.page,
        validationStatus: r.validationStatus,
        confidence: r.validationConfidence ?? r.confidence,
        reason: r.validationReason,
        isDynamicParameter: r.isDynamicParameter,
      })),
      rejectedParameters: validation.rejected.map((r) => ({
        parameter: r.parameter,
        value: r.value,
        page: r.page,
        validationStatus: r.validationStatus,
        reason: r.validationReason,
        validationRule: r.validationRule,
      })),
      rejectionLog: validation.rejectionLog,
      ruleRegistry: getEnterpriseValidationRuleSummary(),
    };
  }
}

export const tenderParameterValidationService = new TenderParameterValidationService();
