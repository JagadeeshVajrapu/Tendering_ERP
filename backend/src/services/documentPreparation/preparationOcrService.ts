import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { PreparationDocumentOcr, IPreparationOcrPage } from '../../models/PreparationDocumentOcr';
import { PreparationOcrResultDto } from '../../types/documentPreparation';

const SPARSE_PAGE_THRESHOLD = 40;

async function extractPagesWithPdfParse(buffer: Buffer): Promise<IPreparationOcrPage[]> {
  const pages: IPreparationOcrPage[] = [];
  let pageIndex = 0;

  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      pageIndex += 1;
      const textContent = await pageData.getTextContent();
      const text = textContent.items
        .map((item: { str?: string }) => (item.str ? String(item.str) : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push({
        pageNumber: pageIndex,
        text,
        charCount: text.length,
        method: 'pdf-parse',
      });
      return text;
    },
  });

  return pages;
}

async function extractWithTesseract(buffer: Buffer): Promise<string> {
  const { data } = await Tesseract.recognize(buffer, 'eng', { logger: () => {} });
  return data.text?.replace(/\s+/g, ' ').trim() || '';
}

function computeQualityScore(pages: IPreparationOcrPage[]): number {
  if (!pages.length) return 0;
  const avg = pages.reduce((sum, p) => sum + p.charCount, 0) / pages.length;
  return Math.min(100, Math.round((avg / 500) * 100));
}

function toDto(record: {
  _id: Types.ObjectId;
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  status: PreparationOcrResultDto['status'];
  method: PreparationOcrResultDto['method'];
  fullText: string;
  pages: IPreparationOcrPage[];
  pageCount: number;
  qualityScore: number;
  processingTimeMs: number;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): PreparationOcrResultDto {
  return {
    id: String(record._id),
    tenderId: String(record.tenderId),
    documentId: String(record.documentId),
    status: record.status,
    method: record.method,
    fullText: record.fullText,
    pages: record.pages,
    pageCount: record.pageCount,
    qualityScore: record.qualityScore,
    processingTimeMs: record.processingTimeMs,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: record.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

class PreparationOcrService {
  async getResult(tenderId: string, documentId: string): Promise<PreparationOcrResultDto | null> {
    const record = await PreparationDocumentOcr.findOne({
      tenderId: new Types.ObjectId(tenderId),
      documentId: new Types.ObjectId(documentId),
    }).lean();
    return record ? toDto(record as Parameters<typeof toDto>[0]) : null;
  }

  async runOcr(
    tenderId: string,
    documentId: string,
    buffer: Buffer,
    userId: Types.ObjectId
  ): Promise<PreparationOcrResultDto> {
    const started = Date.now();
    const tenderObjectId = new Types.ObjectId(tenderId);
    const documentObjectId = new Types.ObjectId(documentId);

    await PreparationDocumentOcr.findOneAndUpdate(
      { documentId: documentObjectId },
      {
        tenderId: tenderObjectId,
        documentId: documentObjectId,
        status: 'processing',
        processedBy: userId,
        errorMessage: '',
      },
      { upsert: true, new: true }
    );

    try {
      let pages = await extractPagesWithPdfParse(buffer);
      let method: PreparationOcrResultDto['method'] = 'pdf-parse';

      const sparsePages = pages.filter((p) => p.charCount < SPARSE_PAGE_THRESHOLD);
      const totalChars = pages.reduce((sum, p) => sum + p.charCount, 0);

      if (!pages.length || totalChars < 100 || sparsePages.length >= Math.ceil(pages.length * 0.5)) {
        const tesseractText = await extractWithTesseract(buffer);
        method = pages.length ? 'hybrid' : 'tesseract';

        if (tesseractText) {
          if (!pages.length) {
            pages = [{ pageNumber: 1, text: tesseractText, charCount: tesseractText.length, method: 'tesseract' }];
          } else {
            const perPage = Math.ceil(tesseractText.length / pages.length);
            pages = pages.map((page, idx) => {
              if (page.charCount >= SPARSE_PAGE_THRESHOLD) return page;
              const slice = tesseractText.slice(idx * perPage, (idx + 1) * perPage).trim();
              return {
                ...page,
                text: slice || page.text,
                charCount: (slice || page.text).length,
                method: 'hybrid' as const,
              };
            });
          }
        }
      }

      const fullText = pages.map((p) => p.text).filter(Boolean).join('\n\n--- Page Break ---\n\n');
      if (!fullText.trim()) {
        throw new AppError('No text could be extracted from this PDF', 400);
      }

      const qualityScore = computeQualityScore(pages);
      const record = await PreparationDocumentOcr.findOneAndUpdate(
        { documentId: documentObjectId },
        {
          status: 'completed',
          method,
          fullText,
          pages,
          pageCount: pages.length,
          qualityScore,
          processingTimeMs: Date.now() - started,
          errorMessage: '',
        },
        { new: true }
      ).lean();

      return toDto(record as Parameters<typeof toDto>[0]);
    } catch (err) {
      const message = err instanceof AppError ? err.message : err instanceof Error ? err.message : 'OCR failed';
      const record = await PreparationDocumentOcr.findOneAndUpdate(
        { documentId: documentObjectId },
        {
          status: 'failed',
          errorMessage: message,
          processingTimeMs: Date.now() - started,
        },
        { new: true }
      ).lean();
      if (record) return toDto(record as Parameters<typeof toDto>[0]);
      throw err instanceof AppError ? err : new AppError(message, 500);
    }
  }
}

export const preparationOcrService = new PreparationOcrService();
