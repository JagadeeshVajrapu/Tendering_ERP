import { AppError } from '../../middleware/errorHandler';
import { PageText } from '../../types/intelligence';
import { documentOcrService } from '../ocr/documentOcrService';
import { DocumentOcrResult } from '../../types/ocr';

const FAST_SCAN_KEYWORDS = [
  'emd',
  'earnest money',
  'bid submission',
  'last date',
  'submission date',
  'eligibility',
  'qualification',
  'financial',
  'tender value',
  'estimated value',
];

class PageExtractionService {
  async extractPages(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    s3?: { bucket: string; key: string }
  ): Promise<PageText[]> {
    const result = await documentOcrService.extractDocument(buffer, mimeType, fileName, s3);
    return documentOcrService.toPageText(result);
  }

  /** Returns full OCR result including metrics (for persistence + debug). */
  async extractPagesWithMetrics(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    s3?: { bucket: string; key: string }
  ): Promise<{ pages: PageText[]; ocr: DocumentOcrResult }> {
    const ocr = await documentOcrService.extractDocument(buffer, mimeType, fileName, s3);
    return { pages: documentOcrService.toPageText(ocr), ocr };
  }

  getFullText(pages: PageText[]): string {
    return pages.map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n');
  }

  /** Fast path: pages 1-10 + keyword pages (native text only, no Textract). */
  async extractPagesFast(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<{ fastPages: PageText[]; totalPageCount: number }> {
    const pages = await this.extractPages(buffer, mimeType, fileName);
    return { fastPages: selectFastPagesFromList(pages), totalPageCount: pages.length };
  }
}

function selectFastPagesFromList(pages: PageText[]): PageText[] {
  const selected = new Map<number, PageText>();
  for (const p of pages) {
    if (p.pageNumber <= 10) selected.set(p.pageNumber, p);
  }
  for (const p of pages) {
    if (p.pageNumber <= 10) continue;
    const lower = p.text.toLowerCase();
    if (FAST_SCAN_KEYWORDS.some((kw) => lower.includes(kw))) {
      selected.set(p.pageNumber, p);
    }
  }
  return [...selected.values()].sort((a, b) => a.pageNumber - b.pageNumber);
}

export const pageExtractionService = new PageExtractionService();
