import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { enterpriseMasterDatasetService } from '../services/masterTenderDataset/enterpriseMasterDatasetService';

/** GET /api/documents/:id/master-dataset */
export const getDocumentEnterpriseMasterDataset = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const documentId = paramId(req.params.id);
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const result = await enterpriseMasterDatasetService.getForDocument(documentId, refresh);
    sendSuccess(res, result);
  }
);

/** GET /api/debug/:documentId/master-dataset-debug */
export const getDocumentMasterDatasetDebug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const debug = await enterpriseMasterDatasetService.getDebugView(documentId, refresh);
  const dataset = await enterpriseMasterDatasetService.getForDocument(documentId, false);
  sendSuccess(res, { ...dataset, debug });
});

/** GET /api/tender/:id/enterprise-master-dataset */
export const getTenderEnterpriseMasterDataset = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await enterpriseMasterDatasetService.getForDocument(String(document._id), refresh);
  sendSuccess(res, result);
});
