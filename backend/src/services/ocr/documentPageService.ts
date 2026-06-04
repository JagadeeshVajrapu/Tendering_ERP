import { Types } from 'mongoose';
import { DocumentPage } from '../../models/DocumentPage';
import { PageText } from '../../types/intelligence';
import { DocumentOcrResult } from '../../types/ocr';

class DocumentPageService {
  async savePages(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages: PageText[]
  ): Promise<void> {
    await DocumentPage.deleteMany({ documentId });
    if (!pages.length) return;

    await DocumentPage.insertMany(
      pages.map((p) => ({
        documentId,
        tenderId,
        pageNumber: p.pageNumber,
        extractedText: p.text,
        extractionMethod: p.method,
        characterCount: p.charCount,
      }))
    );
  }

  toPageText(
    pages: Array<{
      pageNumber: number;
      extractedText?: string;
      text?: string;
      extractionMethod?: PageText['method'];
      method?: PageText['method'];
      characterCount?: number;
      charCount?: number;
    }>
  ): PageText[] {
    return pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.extractedText ?? p.text ?? '',
      method: (p.extractionMethod ?? p.method ?? 'native') as PageText['method'],
      charCount: p.characterCount ?? p.charCount ?? 0,
    }));
  }

  applyOcrMetadata(
    document: {
      ocrDetectedType?: DocumentOcrResult['detectedType'];
      ocrExtractionMethod?: DocumentOcrResult['extractionMethod'];
      ocrQualityMetrics?: DocumentOcrResult['metrics'];
      ocrProcessingTimeMs?: number;
      pageCount?: number;
      extractedText?: string;
    },
    pages: PageText[],
    ocr: DocumentOcrResult
  ): void {
    document.ocrDetectedType = ocr.detectedType;
    document.ocrExtractionMethod = ocr.extractionMethod;
    document.ocrQualityMetrics = ocr.metrics;
    document.ocrProcessingTimeMs = ocr.processingTimeMs;
    document.pageCount = pages.length;
    document.extractedText = pages.map((p) => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n');
  }
}

export const documentPageService = new DocumentPageService();
