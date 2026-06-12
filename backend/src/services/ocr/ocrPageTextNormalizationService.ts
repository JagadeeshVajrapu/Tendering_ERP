import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from './documentPageService';
import {
  DocumentNoiseRemovalResult,
  DocumentNoiseRemovalStats,
  getDocumentNoiseRemovalRuleSummary,
  removeDocumentNoiseFromPages,
} from './documentNoiseRemovalEngine';

class OcrPageTextNormalizationService {
  /**
   * Ensures OCR pages exist for the document (noise removal is applied on read).
   */
  async ensureNormalized(documentId: Types.ObjectId): Promise<{ ready: boolean; totalPages: number }> {
    const totalPages = await DocumentPage.countDocuments({ documentId });
    return { ready: totalPages > 0, totalPages };
  }

  async loadRawPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  /** Apply document noise removal — only business content for extraction. */
  cleanPagesForExtraction(pages: PageText[]): DocumentNoiseRemovalResult {
    return removeDocumentNoiseFromPages(pages);
  }

  async getCleanPagesForExtraction(documentId: Types.ObjectId): Promise<DocumentNoiseRemovalResult> {
    const raw = await this.loadRawPages(documentId);
    const result = this.cleanPagesForExtraction(raw);

    if (raw.length) {
      console.log('[DocumentNoiseRemoval] Cleaned OCR pages for extraction', {
        documentId: String(documentId),
        ...result.stats,
      });
    }

    return result;
  }

  getRuleSummary() {
    return getDocumentNoiseRemovalRuleSummary();
  }
}

export const ocrPageTextNormalizationService = new OcrPageTextNormalizationService();

export type { DocumentNoiseRemovalStats, DocumentNoiseRemovalResult };
