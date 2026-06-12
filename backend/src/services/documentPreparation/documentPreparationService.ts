import fs from 'fs/promises';
import path from 'path';
import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { PreparationDocument } from '../../models/PreparationDocument';
import { PreparationDocumentOcr } from '../../models/PreparationDocumentOcr';
import { PreparationDocumentValidation } from '../../models/PreparationDocumentValidation';
import { Tender } from '../../models/Tender';
import { fileStorageService } from '../storage/fileStorageService';
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
  PreparationDocumentDto,
  PreparationDocumentListResult,
  PreparationDocumentSource,
  PreparationOcrResultDto,
} from '../../types/documentPreparation';
import {
  compressPdfBuffer,
  getPdfPageCount,
  mergePdfBuffers,
  rotatePdfBuffer,
  sanitizePdfName,
  splitPdfByRanges,
} from './pdfUtilityService';
import { preparationOcrService } from './preparationOcrService';
import {
  addHeaderFooterToPdf,
  addPageNumbersToPdf,
  addWatermarkToPdf,
} from './pdfEditingService';
import { companyTemplateService } from './companyTemplateService';
import { autoFillTemplatePdf } from './templateAutoFillService';
import {
  applyAnnotations,
  applyHighlights,
  applyRedactions,
  applyStamps,
  MarkupRegionInput,
  unlockPasswordProtectedPdf,
} from './pdfAdvancedEditingService';
import { PreparationDocumentMarkup } from '../../models/PreparationDocumentMarkup';
import { PreparationSigningWorkflow } from '../../models/PreparationSigningWorkflow';
import { PreparationSignature } from '../../models/PreparationSignature';
import { assertSubmissionWritable } from '../submissionTracking/submissionLockGuard';

function preparationFolder(tenderId: string): string {
  return `preparation/${tenderId}`;
}

function toDto(
  doc: {
    _id: Types.ObjectId;
    tenderId: Types.ObjectId;
    displayName: string;
    originalName: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    pageCount: number;
    localPath: string;
    source: PreparationDocumentSource;
    metadata?: Record<string, unknown>;
    uploadedBy?: Types.ObjectId | { _id: Types.ObjectId; name?: string };
    createdAt?: Date;
    updatedAt?: Date;
  },
  tenderId: string
): PreparationDocumentDto {
  const uploadedBy =
    doc.uploadedBy && typeof doc.uploadedBy === 'object' && 'name' in doc.uploadedBy
      ? { id: String((doc.uploadedBy as { _id: Types.ObjectId })._id), name: (doc.uploadedBy as { name?: string }).name || '' }
      : doc.uploadedBy
        ? { id: String(doc.uploadedBy), name: '' }
        : undefined;

  const apiBase = `/api/tender/${tenderId}/document-preparation/documents/${String(doc._id)}`;

  return {
    id: String(doc._id),
    tenderId: String(doc.tenderId),
    displayName: doc.displayName,
    originalName: doc.originalName,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    pageCount: doc.pageCount,
    localPath: doc.localPath,
    downloadUrl: `${apiBase}/download`,
    previewUrl: `${apiBase}/preview`,
    source: doc.source,
    metadata: doc.metadata || {},
    uploadedBy,
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

class DocumentPreparationService {
  private async assertTender(tenderId: string) {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);
    return tender;
  }

  async assertDocumentExists(tenderId: string, documentId: string): Promise<void> {
    await this.getDocForTender(tenderId, documentId);
  }

  private async getDocForTender(tenderId: string, documentId: string) {
    if (!Types.ObjectId.isValid(documentId)) {
      throw new AppError('Invalid document id', 400);
    }
    const doc = await PreparationDocument.findOne({
      _id: new Types.ObjectId(documentId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!doc) throw new AppError('Document not found', 404);
    return doc;
  }

  private async readDocBuffer(doc: { localPath: string }): Promise<Buffer> {
    const absolute = fileStorageService.getAbsolutePath(doc.localPath);
    try {
      return await fs.readFile(absolute);
    } catch {
      throw new AppError('Document file missing on server', 404);
    }
  }

  private async persistPdf(
    tenderId: Types.ObjectId,
    userId: Types.ObjectId,
    buffer: Buffer,
    displayName: string,
    source: PreparationDocumentSource,
    metadata: Record<string, unknown> = {}
  ): Promise<PreparationDocumentDto> {
    const safeName = sanitizePdfName(displayName);
    const stored = await fileStorageService.saveFile(buffer, safeName, preparationFolder(String(tenderId)));
    const pageCount = await getPdfPageCount(buffer);

    const created = await PreparationDocument.create({
      tenderId,
      displayName: safeName.replace(/\.pdf$/i, ''),
      fileName: stored.fileName,
      originalName: safeName,
      mimeType: 'application/pdf',
      fileSize: buffer.length,
      pageCount,
      localPath: stored.relativePath,
      uploadedBy: userId,
      source,
      metadata,
    });

    const populated = await PreparationDocument.findById(created._id).populate('uploadedBy', 'name');
    return toDto(populated!, String(tenderId));
  }

  async listDocuments(tenderId: string): Promise<PreparationDocumentListResult> {
    await this.assertTender(tenderId);
    const docs = await PreparationDocument.find({ tenderId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name')
      .lean();

    const documents = docs.map((d) => toDto(d as Parameters<typeof toDto>[0], tenderId));
    const totalSize = documents.reduce((sum, d) => sum + d.fileSize, 0);

    return {
      tenderId,
      documents,
      totalSize,
      totalCount: documents.length,
    };
  }

  async uploadDocuments(
    tenderId: string,
    userId: Types.ObjectId,
    files: Express.Multer.File[]
  ): Promise<PreparationDocumentDto[]> {
    await this.assertTender(tenderId);
    await assertSubmissionWritable(tenderId);
    if (!files.length) throw new AppError('No PDF files provided', 400);

    const created: PreparationDocumentDto[] = [];
    for (const file of files) {
      created.push(
        await this.persistPdf(
          new Types.ObjectId(tenderId),
          userId,
          file.buffer,
          file.originalname,
          'upload',
          { originalUploadName: file.originalname }
        )
      );
    }
    return created;
  }

  async getDocumentFile(tenderId: string, documentId: string): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    const doc = await this.getDocForTender(tenderId, documentId);
    const buffer = await this.readDocBuffer(doc);
    return {
      buffer,
      fileName: sanitizePdfName(doc.displayName),
      mimeType: doc.mimeType,
    };
  }

  async deleteDocument(tenderId: string, documentId: string): Promise<void> {
    await assertSubmissionWritable(tenderId);
    const doc = await this.getDocForTender(tenderId, documentId);
    await fileStorageService.deleteFile(doc.localPath);
    await Promise.all([
      PreparationDocument.deleteOne({ _id: doc._id }),
      PreparationDocumentOcr.deleteOne({ documentId: doc._id }),
      PreparationDocumentValidation.deleteOne({ documentId: doc._id }),
      PreparationDocumentMarkup.deleteMany({ documentId: doc._id }),
      PreparationSigningWorkflow.deleteMany({ documentId: doc._id }),
      PreparationSignature.deleteMany({ documentId: doc._id }),
    ]);
  }

  async renameDocument(
    tenderId: string,
    documentId: string,
    displayName: string
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    const doc = await this.getDocForTender(tenderId, documentId);
    const clean = displayName.trim().replace(/\.pdf$/i, '');
    if (!clean) throw new AppError('Display name is required', 400);

    doc.displayName = clean;
    doc.originalName = sanitizePdfName(clean);
    await doc.save();

    const populated = await PreparationDocument.findById(doc._id).populate('uploadedBy', 'name');
    return toDto(populated!, tenderId);
  }

  async bulkRename(tenderId: string, items: BulkRenameItem[]): Promise<PreparationDocumentDto[]> {
    await assertSubmissionWritable(tenderId);
    if (!items.length) throw new AppError('No rename items provided', 400);
    const updated: PreparationDocumentDto[] = [];
    for (const item of items) {
      updated.push(await this.renameDocument(tenderId, item.documentId, item.displayName));
    }
    return updated;
  }

  async mergePdfs(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfMergeRequest
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentIds?.length || body.documentIds.length < 2) {
      throw new AppError('Select at least two PDFs to merge', 400);
    }

    const buffers: Buffer[] = [];
    for (const id of body.documentIds) {
      const doc = await this.getDocForTender(tenderId, id);
      buffers.push(await this.readDocBuffer(doc));
    }

    const { buffer, pageCount } = await mergePdfBuffers(buffers);
    const outputName = body.outputName?.trim() || `Merged_${Date.now()}`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'merge', {
      mergedFrom: body.documentIds,
      pageCount,
    });
  }

  async splitPdf(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfSplitRequest
  ): Promise<PreparationDocumentDto[]> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);
    if (!body.ranges?.length) throw new AppError('At least one page range is required', 400);

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const buffer = await this.readDocBuffer(doc);
    if (!buffer.length) throw new AppError('Source PDF file is empty', 400);

    const parts = await splitPdfByRanges(buffer, body.ranges);
    if (!parts.length) throw new AppError('No pages matched the requested range', 400);

    const created: PreparationDocumentDto[] = [];
    for (let i = 0; i < parts.length; i++) {
      const range = body.ranges[i];
      const name =
        range.name?.trim() ||
        `${doc.displayName}_p${parts[i].from}-${parts[i].to}`;
      created.push(
        await this.persistPdf(new Types.ObjectId(tenderId), userId, parts[i].buffer, name, 'split', {
          sourceDocumentId: body.documentId,
          fromPage: parts[i].from,
          toPage: parts[i].to,
        })
      );
    }
    return created;
  }

  async compressPdf(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfCompressRequest
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    if (!original.length) throw new AppError('Source PDF file is empty', 400);

    const { buffer, pageCount } = await compressPdfBuffer(original);
    const outputName = body.outputName?.trim() || `${doc.displayName}_compressed`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'compress', {
      sourceDocumentId: body.documentId,
      originalSize: original.length,
      compressedSize: buffer.length,
      pageCount,
    });
  }

  async rotatePdf(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfRotateRequest
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);
    if (![90, 180, 270].includes(body.degrees)) {
      throw new AppError('degrees must be 90, 180, or 270', 400);
    }

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    if (!original.length) throw new AppError('Source PDF file is empty', 400);

    const { buffer, pageCount } = await rotatePdfBuffer(original, body.degrees, body.pageNumbers);

    if (body.replaceOriginal) {
      await fileStorageService.deleteFile(doc.localPath);
      const stored = await fileStorageService.saveFile(
        buffer,
        sanitizePdfName(doc.displayName),
        preparationFolder(tenderId)
      );
      doc.fileName = stored.fileName;
      doc.localPath = stored.relativePath;
      doc.fileSize = buffer.length;
      doc.pageCount = pageCount;
      doc.source = 'rotate';
      doc.metadata = {
        ...(doc.metadata || {}),
        rotatedDegrees: body.degrees,
        pageNumbers: body.pageNumbers || 'all',
      };
      await doc.save();
      const populated = await PreparationDocument.findById(doc._id).populate('uploadedBy', 'name');
      return toDto(populated!, tenderId);
    }

    const outputName = body.outputName?.trim() || `${doc.displayName}_rotated_${body.degrees}`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'rotate', {
      sourceDocumentId: body.documentId,
      degrees: body.degrees,
      pageNumbers: body.pageNumbers || 'all',
      pageCount,
    });
  }

  async runDocumentOcr(
    tenderId: string,
    documentId: string,
    userId: Types.ObjectId
  ): Promise<PreparationOcrResultDto> {
    await this.assertTender(tenderId);
    const doc = await this.getDocForTender(tenderId, documentId);
    const buffer = await this.readDocBuffer(doc);
    return preparationOcrService.runOcr(tenderId, documentId, buffer, userId);
  }

  async getDocumentOcr(tenderId: string, documentId: string): Promise<PreparationOcrResultDto | null> {
    await this.assertTender(tenderId);
    await this.getDocForTender(tenderId, documentId);
    return preparationOcrService.getResult(tenderId, documentId);
  }

  async getCompanyTemplate(): Promise<CompanyTemplateDataDto> {
    return companyTemplateService.getTemplate();
  }

  async updateCompanyTemplate(
    userId: Types.ObjectId,
    data: Partial<CompanyTemplateDataDto>
  ): Promise<CompanyTemplateDataDto> {
    return companyTemplateService.updateTemplate(userId, data);
  }

  async addHeaderFooter(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfHeaderFooterRequest
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);
    if (!body.headerText?.trim() && !body.footerText?.trim()) {
      throw new AppError('Provide headerText and/or footerText', 400);
    }

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    const { buffer, pageCount } = await addHeaderFooterToPdf(original, {
      headerText: body.headerText,
      footerText: body.footerText,
      fontSize: body.fontSize,
    });
    const outputName = body.outputName?.trim() || `${doc.displayName}_header_footer`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'header_footer', {
      sourceDocumentId: body.documentId,
      headerText: body.headerText,
      footerText: body.footerText,
      pageCount,
    });
  }

  async addWatermark(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfWatermarkRequest
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);
    if (!body.watermarkText?.trim()) throw new AppError('watermarkText is required', 400);

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    const { buffer, pageCount } = await addWatermarkToPdf(original, {
      watermarkText: body.watermarkText,
      fontSize: body.fontSize,
      opacity: body.opacity,
    });
    const outputName = body.outputName?.trim() || `${doc.displayName}_watermark`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'watermark', {
      sourceDocumentId: body.documentId,
      watermarkText: body.watermarkText,
      pageCount,
    });
  }

  async addPageNumbers(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfPageNumbersRequest
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    const { buffer, pageCount } = await addPageNumbersToPdf(original, {
      format: body.format,
      fontSize: body.fontSize,
      position: body.position,
    });
    const outputName = body.outputName?.trim() || `${doc.displayName}_numbered`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'page_numbers', {
      sourceDocumentId: body.documentId,
      format: body.format || 'Page {n} of {total}',
      pageCount,
    });
  }

  async autoFillTemplate(
    tenderId: string,
    userId: Types.ObjectId,
    body: PdfAutoFillTemplateRequest
  ): Promise<{ document: PreparationDocumentDto; filledFields: string[]; template: CompanyTemplateDataDto }> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);

    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    const template = await companyTemplateService.getTemplate();
    const { buffer, pageCount, filledFields } = await autoFillTemplatePdf(
      original,
      template,
      body.includeCoverPage !== false
    );
    const outputName = body.outputName?.trim() || `${doc.displayName}_autofill`;
    const created = await this.persistPdf(
      new Types.ObjectId(tenderId),
      userId,
      buffer,
      outputName,
      'template_fill',
      { sourceDocumentId: body.documentId, filledFields, pageCount }
    );
    return { document: created, filledFields, template };
  }

  async saveDerivedPdf(
    tenderId: string,
    userId: Types.ObjectId,
    buffer: Buffer,
    displayName: string,
    source: PreparationDocumentSource,
    metadata: Record<string, unknown> = {}
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, displayName, source, metadata);
  }

  async unlockPdf(
    tenderId: string,
    userId: Types.ObjectId,
    body: { documentId: string; password: string; outputName?: string }
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    if (!body.documentId) throw new AppError('documentId is required', 400);
    const doc = await this.getDocForTender(tenderId, body.documentId);
    const original = await this.readDocBuffer(doc);
    const { buffer, pageCount } = await unlockPasswordProtectedPdf(original, body.password);
    const outputName = body.outputName?.trim() || `${doc.displayName}_unlocked`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, buffer, outputName, 'unlock', {
      sourceDocumentId: body.documentId,
      pageCount,
    });
  }

  async applyAdvancedMarkup(
    tenderId: string,
    userId: Types.ObjectId,
    input: {
      documentId: string;
      markupType: 'annotation' | 'highlight' | 'redaction' | 'stamp';
      regions: MarkupRegionInput[];
      outputName?: string;
    }
  ): Promise<PreparationDocumentDto> {
    await assertSubmissionWritable(tenderId);
    const doc = await this.getDocForTender(tenderId, input.documentId);
    const original = await this.readDocBuffer(doc);

    let result: { buffer: Buffer; pageCount: number };
    let source: PreparationDocumentSource;
    switch (input.markupType) {
      case 'redaction':
        result = await applyRedactions(original, input.regions);
        source = 'redact';
        break;
      case 'annotation':
        result = await applyAnnotations(original, input.regions);
        source = 'annotate';
        break;
      case 'highlight':
        result = await applyHighlights(original, input.regions);
        source = 'highlight';
        break;
      case 'stamp':
        result = await applyStamps(original, input.regions);
        source = 'stamp';
        break;
      default:
        throw new AppError('Unsupported markup type', 400);
    }

    const outputName =
      input.outputName?.trim() || `${doc.displayName}_${input.markupType}`;
    return this.persistPdf(new Types.ObjectId(tenderId), userId, result.buffer, outputName, source, {
      sourceDocumentId: input.documentId,
      markupType: input.markupType,
      regionCount: input.regions.length,
      pageCount: result.pageCount,
    });
  }
}

export const documentPreparationService = new DocumentPreparationService();
