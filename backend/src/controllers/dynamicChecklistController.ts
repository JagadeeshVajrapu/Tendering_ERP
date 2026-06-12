import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { Tender } from '../models/Tender';
import { TenderDocument } from '../models/TenderDocument';
import { dynamicChecklistService } from '../services/dynamicChecklist/dynamicChecklistService';
import { dynamicChecklistExportService } from '../services/dynamicChecklist/dynamicChecklistExportService';

/** GET /api/debug/:documentId/dynamic-checklist */
export const getDocumentDynamicChecklist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const result = await dynamicChecklistService.getChecklist(documentId, refresh);
  sendSuccess(res, result);
});

/** GET /api/tender/:id/dynamic-checklist */
export const getTenderDynamicChecklist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';

  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await dynamicChecklistService.getChecklist(String(document._id), refresh);
  sendSuccess(res, result);
});

/** PATCH /api/tender/:id/dynamic-checklist/items/:itemId */
export const updateTenderChecklistItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const itemId = paramId(req.params.itemId);
  const { action, note, documentId: linkedDocId } = req.body;

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await dynamicChecklistService.updateItemWorkflow(
    String(document._id),
    req.user!._id,
    req.user!.role,
    { itemId, action, note, documentId: linkedDocId }
  );

  sendSuccess(res, result);
});

/** GET /api/tender/:id/dynamic-checklist/export */
export const exportTenderDynamicChecklist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const format = String(req.query.format || 'json').toLowerCase();
  const sectionId = req.query.section as string | undefined;

  const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!document) throw new AppError('No document found for this tender.', 404);

  const result = await dynamicChecklistService.getChecklist(String(document._id), false);
  const baseName = `Checklist_${tenderId}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.json"`);
    res.send(dynamicChecklistExportService.toJson(result));
    return;
  }

  if (format === 'excel') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
    res.send(dynamicChecklistExportService.toExcelCsv(result));
    return;
  }

  if (format === 'pdf') {
    const section = sectionId ? result.categories.find((c) => c.id === sectionId) : undefined;
    const pdf = section
      ? await dynamicChecklistExportService.sectionPdfBuffer(section, result)
      : await dynamicChecklistExportService.fullPdfBuffer(result);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}${section ? `_${section.id}` : ''}.pdf"`
    );
    res.send(pdf);
    return;
  }

  throw new AppError('Invalid format. Use json, excel, or pdf.', 400);
});
