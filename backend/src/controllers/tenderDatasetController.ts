import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { IntelligenceJob } from '../models/IntelligenceJob';
import { DocumentFieldValidation, IDocumentFieldValidation } from '../models/DocumentFieldValidation';
import { DocumentNitExtractedField, IDocumentNitExtractedField } from '../models/DocumentNitExtractedField';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { masterDatasetService } from '../services/masterDataset/masterDatasetService';
import { MASTER_FIELD_SOURCE_ALIASES } from '../services/masterDataset/masterDatasetFieldRegistry';
import { MASTER_DATASET_KEYS, MasterDatasetKey, MasterTenderDataset } from '../types/masterDataset';

function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function enrichDataset(
  documentId: Types.ObjectId,
  dataset: MasterTenderDataset
): Promise<Record<MasterDatasetKey, MasterTenderDataset[MasterDatasetKey] & {
  validationResult: string;
  extractionMethod: string;
}>> {
  const [validations, extracted] = await Promise.all([
    DocumentFieldValidation.find({ documentId }),
    DocumentNitExtractedField.find({ documentId }),
  ]);

  const validationByLabel = new Map<string, IDocumentFieldValidation>();
  for (const v of validations) {
    validationByLabel.set(normalizeLabel(v.fieldName), v);
  }

  const extractionByLabel = new Map<string, IDocumentNitExtractedField>();
  for (const e of extracted) {
    extractionByLabel.set(normalizeLabel(e.fieldName), e);
  }

  const enriched = {} as Record<MasterDatasetKey, MasterTenderDataset[MasterDatasetKey] & {
    validationResult: string;
    extractionMethod: string;
  }>;

  for (const key of MASTER_DATASET_KEYS) {
    const field = dataset[key];
    const aliases = MASTER_FIELD_SOURCE_ALIASES[key] || [];

    let validation: IDocumentFieldValidation | undefined;
    let extraction: IDocumentNitExtractedField | undefined;
    for (const alias of aliases) {
      const norm = normalizeLabel(alias);
      if (!validation) validation = validationByLabel.get(norm);
      if (!extraction) extraction = extractionByLabel.get(norm);
      if (validation && extraction) break;
    }

    enriched[key] = {
      ...field,
      validationResult: validation
        ? validation.valid
          ? `Valid${validation.reason ? `: ${validation.reason}` : ''}`
          : `Invalid: ${validation.reason || 'Failed validation'}`
        : field.value.trim()
          ? 'Not validated'
          : '—',
      extractionMethod: extraction?.extractionMethod || (field.value.trim() ? 'confidence_merge' : '—'),
    };
  }

  return enriched;
}

async function formatDatasetResponse(
  tenderId: string,
  documentId: string,
  originalName: string | undefined,
  payload: Awaited<ReturnType<typeof masterDatasetService.getOrBuildByDocumentId>>
) {
  const enrichedDataset = await enrichDataset(new Types.ObjectId(documentId), payload.dataset);

  const lowConfidenceFields = MASTER_DATASET_KEYS.filter(
    (k) => enrichedDataset[k].value && enrichedDataset[k].confidence < 80
  ).map((k) => ({
    field: k,
    ...enrichedDataset[k],
  }));

  return {
    tenderId,
    documentId,
    originalName,
    schemaVersion: 1,
    singleSourceOfTruth: true,
    statistics: payload.statistics,
    provenance: payload.provenance,
    dataset: enrichedDataset,
    populatedFields: MASTER_DATASET_KEYS.filter((k) => enrichedDataset[k].value.trim()).map((k) => k),
    lowConfidenceFields,
  };
}

/** GET /api/tender/:id/dataset — master tender dataset for a tender (latest document). */
export const getTenderDataset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId: new Types.ObjectId(tenderId) }).sort({
    createdAt: -1,
  });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });
  const payload = await masterDatasetService.getOrBuildByDocumentId(
    document._id,
    document.tenderId,
    job?._id
  );

  sendSuccess(res, await formatDatasetResponse(String(tender._id), String(document._id), document.originalName, payload));
});

/** GET /api/debug/:documentId/dataset — master dataset by document (debug / inspection). */
export const getDocumentDataset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });
  const payload = await masterDatasetService.getOrBuildByDocumentId(
    document._id,
    document.tenderId,
    job?._id
  );

  sendSuccess(res, await formatDatasetResponse(String(document.tenderId), String(document._id), document.originalName, payload));
});
