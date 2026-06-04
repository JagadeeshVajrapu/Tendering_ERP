import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { DocumentPage } from '../../models/DocumentPage';
import { DocumentOcrNormalizedRecord } from '../../models/DocumentOcrNormalizedRecord';
import { TenderDocument } from '../../models/TenderDocument';
import { PageText } from '../../types/intelligence';
import { OcrNormalizationResult } from '../../types/ocrNormalization';
import { documentPageService } from './documentPageService';
import { normalizeOcrPages } from './ocrNormalizationEngine';

class OcrNormalizationService {
  async loadPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  normalizeFromPages(pages: PageText[]): OcrNormalizationResult['records'] {
    return normalizeOcrPages(pages);
  }

  buildResult(
    documentId: string,
    tenderId: string,
    pages: PageText[],
    records: OcrNormalizationResult['records']
  ): OcrNormalizationResult {
    const pageSummaries = pages.map((p) => ({
      page: p.pageNumber,
      recordCount: records.filter((r) => r.page === p.pageNumber).length,
      characterCount: p.charCount || (p.text?.length ?? 0),
    }));

    return {
      documentId,
      tenderId,
      pagesScanned: pages.length,
      totalRecords: records.length,
      records,
      pageSummaries,
    };
  }

  async normalizeAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages?: PageText[]
  ): Promise<OcrNormalizationResult> {
    const pageTexts = pages?.length ? pages : await this.loadPages(documentId);
    const records = normalizeOcrPages(pageTexts);

    await DocumentOcrNormalizedRecord.deleteMany({ documentId });
    if (records.length) {
      await DocumentOcrNormalizedRecord.insertMany(
        records.map((r) => ({
          documentId,
          tenderId,
          label: r.label,
          value: r.value,
          pageNumber: r.page,
          sourceText: r.sourceText ?? `${r.label}: ${r.value}`,
        }))
      );
    }

    console.log('[OCR Normalization] Stored', {
      documentId: String(documentId),
      pages: pageTexts.length,
      records: records.length,
    });

    return this.buildResult(String(documentId), String(tenderId), pageTexts, records);
  }

  async getStored(documentId: Types.ObjectId): Promise<OcrNormalizationResult['records']> {
    const stored = await DocumentOcrNormalizedRecord.find({ documentId }).sort({
      pageNumber: 1,
      label: 1,
    });
    return stored.map((r) => ({
      label: r.label,
      value: r.value,
      page: r.pageNumber,
      sourceText: r.sourceText,
    }));
  }

  async getOrNormalize(
    documentId: Types.ObjectId,
    opts?: { refresh?: boolean; pages?: PageText[] }
  ): Promise<OcrNormalizationResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const pages = opts?.pages?.length ? opts.pages : await this.loadPages(documentId);
    if (!pages.length) {
      throw new AppError('No OCR pages found. Run OCR first.', 400);
    }

    if (!opts?.refresh) {
      const stored = await this.getStored(documentId);
      if (stored.length) {
        return this.buildResult(String(documentId), String(document.tenderId), pages, stored);
      }
    }

    return this.normalizeAndStore(documentId, document.tenderId, pages);
  }

  /**
   * Gate for extraction pipelines — throws if pages have text but normalization is empty.
   */
  assertNormalizationReady(result: OcrNormalizationResult): void {
    const hasText = result.pageSummaries.some((p) => p.characterCount > 80);
    if (hasText && result.totalRecords === 0) {
      throw new AppError(
        'OCR normalization produced no label–value records. Verify OCR text contains lines like "EMD:" or "Name of Work:" before running extraction.',
        422
      );
    }
  }
}

export const ocrNormalizationService = new OcrNormalizationService();
