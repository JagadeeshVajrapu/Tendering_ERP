import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { AppError } from '../middleware/errorHandler';
import { DocumentPage } from '../models/DocumentPage';
import { validatedMasterDatasetService } from '../services/masterTenderDataset/validatedMasterDatasetService';
import { tenderParameterCandidateExtractionService } from '../services/tenderParameter/tenderParameterCandidateExtractionService';
import { isOpenAIApiError } from '../services/ai/openaiClient';
import { isGeminiApiError } from '../services/ai/geminiClient';
import { ValidatedMasterDatasetResult } from '../types/validatedMasterDataset';

function isAiQuotaError(err: unknown): boolean {
  return isOpenAIApiError(err) || isGeminiApiError(err);
}

function mapParameters(master: ValidatedMasterDatasetResult) {
  return master.parameters
    .filter((p) => p.validationStatus === 'validated' && p.value?.trim())
    .map((p) => ({
      parameterName: p.parameter,
      parameterValue: p.value,
      pageNumber: p.page,
      sourcePage: p.page,
      confidence: p.confidence,
      category: p.category,
      parameterType: p.parameterType,
      validationStatus: p.validationStatus,
      canonicalKey: p.canonicalKey,
    }));
}

/** GET /api/tender/:id/discovered-parameters — validated master-dictionary parameters only */
export const getTenderDiscoveredParameters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const pageCount = await DocumentPage.countDocuments({ documentId: document._id });
  if (!pageCount) {
    sendSuccess(res, {
      documentId: String(document._id),
      tenderId: String(tender._id),
      pagesScanned: 0,
      totalFound: 0,
      parameters: [],
      originalName: document.originalName,
      dataSource: 'awaiting_ocr',
    });
    return;
  }

  let master: ValidatedMasterDatasetResult | null = null;

  try {
    if (refresh) {
      await tenderParameterCandidateExtractionService.extractAndStore(
        document._id,
        document.tenderId,
        { refresh: true }
      );
    }

    master = await validatedMasterDatasetService.getOrBuild(document._id, document.tenderId, {
      refresh,
    });
  } catch (err) {
    if (!isAiQuotaError(err)) throw err;

    master = await validatedMasterDatasetService.getByDocumentId(document._id);
    if (!master) {
      sendSuccess(res, {
        documentId: String(document._id),
        tenderId: String(tender._id),
        pagesScanned: pageCount,
        totalFound: 0,
        parameters: [],
        originalName: document.originalName,
        dataSource: 'awaiting_ai_quota',
      });
      return;
    }
  }

  const parameters = mapParameters(master);

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(tender._id),
    pagesScanned: pageCount,
    totalFound: parameters.length,
    parameters,
    originalName: document.originalName,
    dataSource: 'validated_master_dataset',
  });
});
