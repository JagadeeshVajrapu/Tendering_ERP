import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { textractService } from '../tenderExtraction/textractService';
import { detectByMimeAndExt } from '../tenderExtraction/fileTypeDetector';
import { DocumentOcrResult, OcrDocumentType, OcrExtractionMethod, OcrPageResult } from '../../types/ocr';
import { buildOcrQualityMetrics } from './ocrQualityMetrics';
import { PageText } from '../../types/intelligence';

const MIN_PAGE_CHARS = 40;
const SCANNED_EMPTY_RATIO = 0.6;

type PdfPageRenderData = {
  pageIndex: number;
  getTextContent: (opts: object) => Promise<{ items: { str: string }[] }>;
};

class DocumentOcrService {
  /**
   * Full document OCR — page-wise text + type detection + quality metrics.
   */
  async extractDocument(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    s3?: { bucket: string; key: string }
  ): Promise<DocumentOcrResult> {
    const started = Date.now();
    const baseType = detectByMimeAndExt(mimeType, fileName);

    console.log('[OCR] Start', { fileName, mimeType, baseType, bytes: buffer.length });

    let result: DocumentOcrResult;

    if (baseType === 'docx') {
      result = await this.extractDocx(buffer, started);
    } else if (baseType === 'image') {
      result = await this.extractImage(buffer, started);
    } else if (baseType === 'digital_pdf') {
      result = await this.extractPdf(buffer, s3, started);
    } else {
      throw new AppError(`Unsupported file type: ${mimeType}`, 400);
    }

    console.log('[OCR] End', {
      fileName,
      detectedType: result.detectedType,
      extractionMethod: result.extractionMethod,
      totalPages: result.metrics.pages,
      totalCharacters: result.metrics.totalCharacters,
      averageCharactersPerPage: result.metrics.averageCharactersPerPage,
      qualityScore: result.metrics.qualityScore,
      processingTimeMs: result.processingTimeMs,
    });

    return result;
  }

  toPageText(result: DocumentOcrResult): PageText[] {
    const method = this.toPageMethod(result.extractionMethod);
    return result.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      charCount: p.characterCount,
      method,
    }));
  }

  private toPageMethod(method: OcrExtractionMethod): PageText['method'] {
    if (method === 'pdf-parse') return 'pdf-parse';
    if (method === 'textract') return 'textract';
    return 'mammoth';
  }

  private finish(
    detectedType: OcrDocumentType,
    extractionMethod: OcrExtractionMethod,
    pages: OcrPageResult[],
    started: number
  ): DocumentOcrResult {
    const metrics = buildOcrQualityMetrics(pages);
    return {
      detectedType,
      extractionMethod,
      pages,
      metrics,
      processingTimeMs: Date.now() - started,
    };
  }

  private async extractPdf(
    buffer: Buffer,
    s3: { bucket: string; key: string } | undefined,
    started: number
  ): Promise<DocumentOcrResult> {
    const digitalPages = await this.extractDigitalPdfWithPdfParse(buffer);

    const emptyRatio =
      digitalPages.filter((p) => p.characterCount < MIN_PAGE_CHARS).length /
      Math.max(1, digitalPages.length);

    const isScanned = emptyRatio >= SCANNED_EMPTY_RATIO;

    if (!isScanned) {
      return this.finish('digital_pdf', 'pdf-parse', digitalPages, started);
    }

    if (!env.aws.accessKeyId) {
      console.warn('[OCR] Scanned PDF detected but AWS Textract is not configured — returning sparse pdf-parse output');
      return this.finish('scanned_pdf', 'pdf-parse', digitalPages, started);
    }

    if (!s3?.bucket || !s3.key) {
      console.warn('[OCR] Scanned PDF requires S3 for Textract — returning sparse pdf-parse output');
      return this.finish('scanned_pdf', 'pdf-parse', digitalPages, started);
    }

    const texPages = await this.extractScannedPdfWithTextract(s3, digitalPages.length);
    return this.finish('scanned_pdf', 'textract', texPages, started);
  }

  private async extractDigitalPdfWithPdfParse(buffer: Buffer): Promise<OcrPageResult[]> {
    const pageTexts = new Map<number, string>();

    const options = {
      pagerender: async (pageData: PdfPageRenderData) => {
        const content = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });
        const text = content.items
          .map((item) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        pageTexts.set(pageData.pageIndex + 1, text);
        return text;
      },
    };

    const data = await pdfParse(buffer, options);
    const numPages = data.numpages || pageTexts.size || 1;

    const pages: OcrPageResult[] = [];
    for (let i = 1; i <= numPages; i++) {
      const text = pageTexts.get(i) || '';
      pages.push({ pageNumber: i, text, characterCount: text.length });
    }
    return pages;
  }

  private async extractScannedPdfWithTextract(
    s3: { bucket: string; key: string },
    fallbackPageCount: number
  ): Promise<OcrPageResult[]> {
    const { pages: texPages, pageCount } = await textractService.detectTextPagesFromS3Pdf(s3);
    const total = Math.max(pageCount, fallbackPageCount, 1);
    const pages: OcrPageResult[] = [];

    for (let i = 1; i <= total; i++) {
      const text = (texPages[i] || '').trim();
      pages.push({ pageNumber: i, text, characterCount: text.length });
    }
    return pages;
  }

  private async extractDocx(buffer: Buffer, started: number): Promise<DocumentOcrResult> {
    const result = await mammoth.extractRawText({ buffer });
    const fullText = result.value?.trim() || '';
    if (!fullText) {
      throw new AppError('Could not extract text from DOCX.', 400);
    }

    const byBreak = fullText.split(/\f|\n{3,}/).filter((s) => s.trim());
    let pages: OcrPageResult[];

    if (byBreak.length > 1) {
      pages = byBreak.map((text, i) => {
        const trimmed = text.trim();
        return { pageNumber: i + 1, text: trimmed, characterCount: trimmed.length };
      });
    } else {
      const estimatedPages = Math.max(1, Math.ceil(fullText.length / 3000));
      const segments = this.splitTextEvenly(fullText, estimatedPages);
      pages = segments.map((text, i) => {
        const trimmed = text.trim();
        return { pageNumber: i + 1, text: trimmed, characterCount: trimmed.length };
      });
    }

    return this.finish('docx', 'mammoth', pages, started);
  }

  private async extractImage(buffer: Buffer, started: number): Promise<DocumentOcrResult> {
    if (!env.aws.accessKeyId) {
      throw new AppError(
        'Image OCR requires AWS Textract. Configure AWS_ACCESS_KEY_ID and related env vars.',
        500
      );
    }

    const text = await textractService.detectTextFromImageBytes(buffer);
    const trimmed = text.trim();
    const pages: OcrPageResult[] = [
      { pageNumber: 1, text: trimmed, characterCount: trimmed.length },
    ];
    return this.finish('image', 'textract', pages, started);
  }

  private splitTextEvenly(text: string, pageCount: number): string[] {
    const byFormFeed = text.split('\f').filter((s) => s.trim());
    if (byFormFeed.length >= pageCount * 0.5) {
      const result = [...byFormFeed];
      while (result.length < pageCount) result.push('');
      return result.slice(0, pageCount);
    }

    const words = text.split(/\s+/);
    const wordsPerPage = Math.ceil(words.length / pageCount);
    const segments: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      segments.push(words.slice(i * wordsPerPage, (i + 1) * wordsPerPage).join(' '));
    }
    return segments;
  }
}

export const documentOcrService = new DocumentOcrService();
