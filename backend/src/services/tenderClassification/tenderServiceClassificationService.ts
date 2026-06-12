import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { TenderServiceClassification } from '../../models/TenderServiceClassification';
import { PageText } from '../../types/intelligence';
import { TenderServiceClassificationRecord } from '../../types/tenderServiceClassification';
import { documentPageService } from '../ocr/documentPageService';
import { classifyTenderServiceFromPages } from './tenderServiceClassificationEngine';
import { isSupportedServiceCategory } from './serviceClassificationKnowledgeBase';

class TenderServiceClassificationService {
  async loadPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  private toRecord(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pagesScanned: number,
    row: {
      serviceCategory: string;
      confidence: number;
      matchedKeywords: string[];
      categoryScores: Record<string, number>;
      classifiedAt?: Date;
    }
  ): TenderServiceClassificationRecord {
    return {
      documentId: String(documentId),
      tenderId: String(tenderId),
      serviceCategory: row.serviceCategory as TenderServiceClassificationRecord['serviceCategory'],
      confidence: row.confidence,
      matchedKeywords: row.matchedKeywords,
      categoryScores: row.categoryScores,
      pagesScanned,
      classifiedAt: (row.classifiedAt || new Date()).toISOString(),
    };
  }

  async classifyAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages?: PageText[],
    opts?: { refresh?: boolean }
  ): Promise<TenderServiceClassificationRecord> {
    if (!opts?.refresh) {
      const existing = await TenderServiceClassification.findOne({ documentId }).lean();
      if (existing) {
        return this.toRecord(documentId, tenderId, existing.pagesScanned, existing);
      }
    }

    const pageList = pages?.length ? pages : await this.loadPages(documentId);
    if (!pageList.length) throw new AppError('No OCR pages available for service classification', 400);

    const result = classifyTenderServiceFromPages(pageList);
    const classifiedAt = new Date();

    await TenderServiceClassification.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        serviceCategory: result.serviceCategory,
        confidence: result.confidence,
        matchedKeywords: result.matchedKeywords,
        categoryScores: result.categoryScores,
        pagesScanned: pageList.length,
        classifiedAt,
      },
      { upsert: true, new: true }
    );

    if (result.serviceCategory && isSupportedServiceCategory(result.serviceCategory)) {
      await TenderDocument.findByIdAndUpdate(documentId, {
        serviceCategory: result.serviceCategory,
        serviceClassificationConfidence: result.confidence,
      });
    }

    console.log('[ServiceClassification] Stored', {
      documentId: String(documentId),
      serviceCategory: result.serviceCategory,
      confidence: result.confidence,
    });

    return this.toRecord(documentId, tenderId, pageList.length, {
      ...result,
      classifiedAt,
    });
  }

  async getClassification(documentId: string, refresh = false): Promise<TenderServiceClassificationRecord> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (refresh) {
      return this.classifyAndStore(document._id, document.tenderId, undefined, { refresh: true });
    }

    const stored = await TenderServiceClassification.findOne({ documentId: document._id }).lean();
    if (stored) {
      return this.toRecord(document._id, document.tenderId, stored.pagesScanned, stored);
    }

    return this.classifyAndStore(document._id, document.tenderId);
  }
}

export const tenderServiceClassificationService = new TenderServiceClassificationService();
