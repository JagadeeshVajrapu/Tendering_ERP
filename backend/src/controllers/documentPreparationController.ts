import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { documentPreparationService } from '../services/documentPreparation/documentPreparationService';
import { documentValidationService } from '../services/documentPreparation/documentValidationService';
import {
  BulkRenameItem,
  CompanyTemplateDataDto,
  PdfAutoFillTemplateRequest,
  PdfCompressRequest,
  PdfHeaderFooterRequest,
  PdfMergeRequest,
  PdfPageNumbersRequest,
  PdfRotateRequest,
  PdfSplitRequest,
  PdfWatermarkRequest,
} from '../types/documentPreparation';

function tenderIdParam(req: AuthRequest): string {
  return paramId(req.params.id);
}

/** GET /api/tender/:id/document-preparation/documents */
export const listPreparationDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.listDocuments(tenderIdParam(req));
  sendSuccess(res, result);
});

function collectUploadedPdfFiles(req: AuthRequest): Express.Multer.File[] {
  const bag = req.files as
    | { file?: Express.Multer.File[]; files?: Express.Multer.File[] }
    | undefined;
  if (bag) return [...(bag.file || []), ...(bag.files || [])];
  return req.file ? [req.file] : [];
}

/** POST /api/tender/:id/document-preparation/documents */
export const uploadPreparationDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = collectUploadedPdfFiles(req);
  if (!files.length) throw new AppError('Upload at least one PDF file (field: file or files)', 400);

  const created = await documentPreparationService.uploadDocuments(
    tenderIdParam(req),
    req.user!._id,
    files
  );
  sendSuccess(res, created, 'Documents uploaded', 201);
});

/** GET /api/tender/:id/document-preparation/documents/:docId/download */
export const downloadPreparationDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, fileName } = await documentPreparationService.getDocumentFile(
    tenderIdParam(req),
    paramId(req.params.docId)
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});

/** GET /api/tender/:id/document-preparation/documents/:docId/preview */
export const previewPreparationDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { buffer, fileName } = await documentPreparationService.getDocumentFile(
    tenderIdParam(req),
    paramId(req.params.docId)
  );
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.send(buffer);
});

/** DELETE /api/tender/:id/document-preparation/documents/:docId */
export const deletePreparationDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  await documentPreparationService.deleteDocument(tenderIdParam(req), paramId(req.params.docId));
  sendSuccess(res, { deleted: true });
});

/** PATCH /api/tender/:id/document-preparation/documents/:docId/rename */
export const renamePreparationDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { displayName } = req.body as { displayName?: string };
  if (!displayName?.trim()) throw new AppError('displayName is required', 400);

  const updated = await documentPreparationService.renameDocument(
    tenderIdParam(req),
    paramId(req.params.docId),
    displayName
  );
  sendSuccess(res, updated);
});

/** PATCH /api/tender/:id/document-preparation/documents/bulk-rename */
export const bulkRenamePreparationDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items } = req.body as { items?: BulkRenameItem[] };
  const updated = await documentPreparationService.bulkRename(tenderIdParam(req), items || []);
  sendSuccess(res, updated);
});

/** POST /api/tender/:id/document-preparation/pdf/merge */
export const mergePreparationPdfs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.mergePdfs(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfMergeRequest
  );
  sendSuccess(res, result, 'PDFs merged', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/split */
export const splitPreparationPdf = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.splitPdf(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfSplitRequest
  );
  sendSuccess(res, result, 'PDF split complete', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/compress */
export const compressPreparationPdf = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.compressPdf(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfCompressRequest
  );
  sendSuccess(res, result, 'PDF compressed', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/rotate */
export const rotatePreparationPdf = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.rotatePdf(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfRotateRequest
  );
  sendSuccess(res, result, 'PDF rotated', 201);
});

/** POST /api/tender/:id/document-preparation/documents/:docId/ocr */
export const runPreparationDocumentOcr = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.runDocumentOcr(
    tenderIdParam(req),
    paramId(req.params.docId),
    req.user!._id
  );
  sendSuccess(res, result, 'OCR completed', 201);
});

/** GET /api/tender/:id/document-preparation/documents/:docId/ocr */
export const getPreparationDocumentOcr = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.getDocumentOcr(
    tenderIdParam(req),
    paramId(req.params.docId)
  );
  if (!result) throw new AppError('OCR has not been run for this document', 404);
  sendSuccess(res, result);
});

/** GET /api/tender/:id/document-preparation/template-data */
export const getCompanyTemplateData = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.getCompanyTemplate();
  sendSuccess(res, result);
});

/** PUT /api/tender/:id/document-preparation/template-data */
export const updateCompanyTemplateData = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.updateCompanyTemplate(
    req.user!._id,
    req.body as Partial<CompanyTemplateDataDto>
  );
  sendSuccess(res, result, 'Company template updated');
});

/** POST /api/tender/:id/document-preparation/pdf/header-footer */
export const addPreparationHeaderFooter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.addHeaderFooter(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfHeaderFooterRequest
  );
  sendSuccess(res, result, 'Header/footer added', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/watermark */
export const addPreparationWatermark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.addWatermark(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfWatermarkRequest
  );
  sendSuccess(res, result, 'Watermark added', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/page-numbers */
export const addPreparationPageNumbers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.addPageNumbers(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfPageNumbersRequest
  );
  sendSuccess(res, result, 'Page numbers added', 201);
});

/** POST /api/tender/:id/document-preparation/pdf/auto-fill */
export const autoFillPreparationTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentPreparationService.autoFillTemplate(
    tenderIdParam(req),
    req.user!._id,
    req.body as PdfAutoFillTemplateRequest
  );
  sendSuccess(res, result, 'Template auto-fill complete', 201);
});

/** GET /api/tender/:id/document-preparation/validation/dashboard */
export const getPreparationValidationDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentValidationService.getDashboard(tenderIdParam(req));
  sendSuccess(res, result);
});

/** GET /api/tender/:id/document-preparation/documents/:docId/validation */
export const getPreparationDocumentValidation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const docId = paramId(req.params.docId);
  await documentPreparationService.assertDocumentExists(tenderIdParam(req), docId);
  const result = await documentValidationService.getDocumentValidation(tenderIdParam(req), docId);
  sendSuccess(res, result);
});

/** POST /api/tender/:id/document-preparation/documents/:docId/validate */
export const validatePreparationDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentValidationService.validateDocument(
    tenderIdParam(req),
    paramId(req.params.docId),
    req.user!._id
  );
  sendSuccess(res, result, 'Document validated', 201);
});

/** POST /api/tender/:id/document-preparation/validation/package */
export const validatePreparationPackage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentValidationService.validatePackage(
    tenderIdParam(req),
    req.user!._id
  );
  sendSuccess(res, result, 'Tender package validated', 201);
});

/** POST /api/tender/:id/document-preparation/documents/:docId/validation/detect-expiry */
export const detectPreparationExpiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentValidationService.detectExpiry(
    tenderIdParam(req),
    paramId(req.params.docId),
    req.user!._id
  );
  sendSuccess(res, result, 'Expiry detection complete', 201);
});

/** POST /api/tender/:id/document-preparation/documents/:docId/validation/detect-blank-pages */
export const detectPreparationBlankPages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentValidationService.detectBlankPagesOnly(
    tenderIdParam(req),
    paramId(req.params.docId),
    req.user!._id
  );
  sendSuccess(res, result, 'Blank page detection complete', 201);
});

/** POST /api/tender/:id/document-preparation/documents/:docId/validation/detect-signature */
export const detectPreparationSignature = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await documentValidationService.detectSignatureOnly(
    tenderIdParam(req),
    paramId(req.params.docId),
    req.user!._id
  );
  sendSuccess(res, result, 'Signature detection complete', 201);
});
