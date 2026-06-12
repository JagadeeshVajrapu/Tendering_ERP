import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { enterpriseDynamicParameterExtractionService } from '../services/tenderParameter/enterpriseDynamicParameterExtractionService';

/** GET /api/debug/:documentId/dynamic-parameter-extraction */
export const getDocumentDynamicParameterExtraction = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const documentId = paramId(req.params.documentId);
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const result = await enterpriseDynamicParameterExtractionService.getExtraction(documentId, refresh);
    sendSuccess(res, result);
  }
);

/** POST /api/debug/dynamic-parameter-extraction/extract-section */
export const postExtractSectionParameters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ocrText, tenderType, sectionName, pages } = req.body as {
    ocrText?: string;
    tenderType?: string;
    sectionName?: string;
    pages?: number[];
  };

  if (!ocrText?.trim()) throw new AppError('ocrText is required', 400);
  if (!sectionName?.trim()) throw new AppError('sectionName is required', 400);

  const parameters = await enterpriseDynamicParameterExtractionService.extractFromSectionInput({
    ocrText: ocrText.trim(),
    tenderType: tenderType?.trim() || 'Unclassified',
    sectionName: sectionName.trim(),
    pages: Array.isArray(pages) ? pages.filter((n) => Number.isFinite(n)) : [],
  });

  sendSuccess(res, {
    tenderType: tenderType?.trim() || 'Unclassified',
    sectionName: sectionName.trim(),
    totalParameters: parameters.length,
    parameters,
  });
});

/** GET /api/tender/:id/dynamic-parameter-extraction */
export const getTenderDynamicParameterExtraction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await enterpriseDynamicParameterExtractionService.getExtraction(
    String(document._id),
    refresh
  );
  sendSuccess(res, result);
});
