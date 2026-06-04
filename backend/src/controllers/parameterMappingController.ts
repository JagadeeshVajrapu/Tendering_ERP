import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { AppError } from '../middleware/errorHandler';
import { parameterMappingService } from '../services/parameterMapping/parameterMappingService';

/** GET /api/tender/:id/parameter-mappings */
export const getTenderParameterMappings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  let parameters;
  if (refresh) {
    const { parameterDiscoveryService } = await import(
      '../services/parameterDiscovery/parameterDiscoveryService'
    );
    const engine = await parameterDiscoveryService.runEngineForDocument(
      document._id,
      document.tenderId,
      true
    );
    parameters = engine.parameters;
  }

  const result = await parameterMappingService.mapDocument(
    document._id,
    document.tenderId,
    parameters
  );

  sendSuccess(res, result);
});

/** GET /api/debug/:documentId/parameter-mappings */
export const getDocumentParameterMappings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  let parameters;
  if (refresh) {
    const { parameterDiscoveryService } = await import(
      '../services/parameterDiscovery/parameterDiscoveryService'
    );
    const engine = await parameterDiscoveryService.runEngineForDocument(
      document._id,
      document.tenderId,
      true
    );
    parameters = engine.parameters;
  }

  const result = await parameterMappingService.mapDocument(
    document._id,
    document.tenderId,
    parameters
  );

  sendSuccess(res, result);
});
