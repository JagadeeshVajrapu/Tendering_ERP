import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { tenderIntelligenceLayerService } from '../services/tenderIntelligence/tenderIntelligenceLayerService';
import { tenderTypeIntelligenceService } from '../services/tenderIntelligence/tenderTypeIntelligenceService';

/** GET /api/debug/:documentId/tender-intelligence */
export const getDocumentTenderIntelligence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const result = await tenderIntelligenceLayerService.getAnalysis(documentId, refresh);
  const typeIntel = await tenderTypeIntelligenceService.getForDocument(documentId, refresh);
  sendSuccess(res, {
    tenderType: typeIntel.tenderType || result.tenderType,
    confidence: typeIntel.confidence || result.confidence,
    sections: result.sections,
    pageClassifications: result.pageClassifications || [],
    documentId: result.documentId,
    tenderId: result.tenderId,
    pagesScanned: result.pagesScanned,
    typeScores: typeIntel.typeScores || result.typeScores,
    matchedKeywords: typeIntel.matchedKeywords,
    analyzedAt: result.analyzedAt,
    profile: typeIntel.profile,
    library: typeIntel.library,
    libraryContext: typeIntel.libraryContext,
    extractionContext: typeIntel.extractionContext,
  });
});

/** GET /api/tender/:id/tender-intelligence */
export const getTenderTenderIntelligence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await tenderIntelligenceLayerService.getAnalysis(String(document._id), refresh);
  const typeIntel = await tenderTypeIntelligenceService.getForDocument(String(document._id), refresh);
  sendSuccess(res, {
    tenderType: typeIntel.tenderType || result.tenderType,
    confidence: typeIntel.confidence || result.confidence,
    sections: result.sections,
    pageClassifications: result.pageClassifications || [],
    documentId: result.documentId,
    tenderId: result.tenderId,
    pagesScanned: result.pagesScanned,
    typeScores: typeIntel.typeScores || result.typeScores,
    matchedKeywords: typeIntel.matchedKeywords,
    analyzedAt: result.analyzedAt,
    profile: typeIntel.profile,
    library: typeIntel.library,
    libraryContext: typeIntel.libraryContext,
    extractionContext: typeIntel.extractionContext,
  });
});
