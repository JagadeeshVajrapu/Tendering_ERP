import fs from 'fs/promises';
import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { fileStorageService } from '../storage/fileStorageService';
import { pageExtractionService } from '../intelligence/pageExtractionService';
import { documentPageService } from './documentPageService';
import { OCR_MIN_QUALITY_SCORE, resolveOcrQualityMetrics } from './ocrQualityMetrics';
import { OcrQualityMetrics } from '../../types/ocr';

export interface OcrDebugPage {
  pageNumber: number;
  extractedText: string;
  extractionMethod: string;
  characterCount: number;
}

export interface OcrDebugPagesResponse {
  documentId: string;
  tenderId: string;
  originalName?: string;
  mimeType?: string;
  detectedType?: string;
  documentExtractionMethod?: string;
  processingTimeMs: number | null;
  qualityMetrics: OcrQualityMetrics;
  qualityThreshold: number;
  passesQualityGate: boolean;
  pageCount: number;
  pages: OcrDebugPage[];
}

class OcrDebugService {
  async loadPages(documentId: Types.ObjectId): Promise<OcrDebugPage[]> {
    const stored = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return stored.map((p) => ({
      pageNumber: p.pageNumber,
      extractedText: p.extractedText,
      extractionMethod: p.extractionMethod,
      characterCount: p.characterCount,
    }));
  }

  async ensurePagesStored(document: InstanceType<typeof TenderDocument>): Promise<OcrDebugPage[]> {
    let pages = await this.loadPages(document._id);
    if (pages.length) return pages;

    if (!document.localPath) {
      throw new AppError(
        'No OCR pages stored yet. Upload the document and wait for OCR to finish, or re-upload.',
        400
      );
    }

    const buffer = await fs.readFile(fileStorageService.getAbsolutePath(document.localPath));
    const { pages: extracted, ocr } = await pageExtractionService.extractPagesWithMetrics(
      buffer,
      document.mimeType,
      document.originalName,
      { bucket: env.aws.bucket, key: document.s3Key }
    );

    documentPageService.applyOcrMetadata(document, extracted, ocr);
    await documentPageService.savePages(document._id, document.tenderId, extracted);
    await document.save();

    return this.loadPages(document._id);
  }

  async getPagesDebug(documentId: string): Promise<OcrDebugPagesResponse> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const pages = await this.ensurePagesStored(document);
    const stored = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
    const pageTexts = documentPageService.toPageText(stored);

    const qualityMetrics = resolveOcrQualityMetrics(document.ocrQualityMetrics, pageTexts);

    return {
      documentId: String(document._id),
      tenderId: String(document.tenderId),
      originalName: document.originalName,
      mimeType: document.mimeType,
      detectedType: document.ocrDetectedType || undefined,
      documentExtractionMethod: document.ocrExtractionMethod || undefined,
      processingTimeMs: document.ocrProcessingTimeMs ?? null,
      qualityMetrics,
      qualityThreshold: OCR_MIN_QUALITY_SCORE,
      passesQualityGate: qualityMetrics.qualityScore >= OCR_MIN_QUALITY_SCORE,
      pageCount: pages.length,
      pages,
    };
  }
}

export const ocrDebugService = new OcrDebugService();
