import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { TenderDocument } from '../models/TenderDocument';
import { DocumentPage } from '../models/DocumentPage';
import { TenderIntelligence } from '../models/TenderIntelligence';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { riskAnalysisEngine } from '../services/risk/riskAnalysisEngine';
import { verifiedNitJsonBuilder } from '../services/intelligence/verifiedNitJsonBuilder';
import { buildEmptyMerged } from '../services/intelligence/fields';
import { validateMergedField } from '../services/intelligence/valueValidator';
import { IntelligenceFieldKey, MergedIntelligence } from '../types/intelligence';
import { ExtractedProductionField } from '../services/intelligence/extractedProductionField';
import { computeConsultantRecommendation } from '../services/intelligence/consultantExecutiveOutputs';
import { documentPageService } from '../services/ocr/documentPageService';

/** GET /api/debug/:documentId/risks — risk engine output (requires verified pipeline fields). */
export const getDocumentRisksDebug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  const pages = await DocumentPage.find({ documentId: new Types.ObjectId(documentId) }).sort({
    pageNumber: 1,
  });
  if (!pages.length) {
    throw new AppError('OCR pages not found. Run OCR before risk analysis.', 400);
  }

  const intelligence = await TenderIntelligence.findOne({
    documentId: document._id,
  }).sort({ createdAt: -1 });

  const productionFields = (intelligence?.productionFields || []) as ExtractedProductionField[];
  if (!productionFields.length) {
    throw new AppError(
      'No verified production fields. Complete extraction pipeline before risk analysis.',
      400
    );
  }

  const pageTexts = documentPageService.toPageText(pages);

  const verifiedNit = verifiedNitJsonBuilder.build(productionFields);
  const merged = buildEmptyMerged() as MergedIntelligence;
  for (const pf of productionFields) {
    const key = pf.mergeKey as IntelligenceFieldKey;
    merged[key] = validateMergedField(key, {
      value: pf.value,
      sourcePages: [pf.sourcePage],
      confidence: pf.confidence,
      validated: true,
      allExtractions: [{ value: pf.value, page: pf.sourcePage, confidence: pf.confidence }],
    });
  }

  const recommendation = computeConsultantRecommendation(productionFields, verifiedNit);
  const stagesCompleted = [
    'step_2_candidate_collection',
    'step_4_validation',
    'step_5_ai_verification',
    'step_6_structured_json',
  ];

  const prerequisites = riskAnalysisEngine.checkPrerequisites({
    pages: pageTexts,
    productionFields,
    stagesCompleted,
  });

  const riskAnalysis = riskAnalysisEngine.analyze({
    pages: pageTexts,
    productionFields,
    verifiedNit,
    merged,
    recommendation,
    stagesCompleted,
  });

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    prerequisites,
    riskAnalysis,
    nitRiskItems: riskAnalysisEngine.toNitRiskItems(riskAnalysis),
  });
});
