import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { DocumentLabelValuePair } from '../../models/DocumentLabelValuePair';
import { documentPageService } from '../ocr/documentPageService';
import { LabelValueExtractionResult } from '../../types/labelValuePair';
import { extractLabelValuePairs } from './labelValueExtractor';

class LabelValueService {
  async loadAllPages(documentId: Types.ObjectId) {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  async savePairs(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    result: LabelValueExtractionResult
  ): Promise<void> {
    await DocumentLabelValuePair.deleteMany({ documentId });
    if (!result.pairs.length) return;

    await DocumentLabelValuePair.insertMany(
      result.pairs.map((p) => ({
        documentId,
        tenderId,
        label: p.label,
        value: p.value,
        pageNumber: p.page,
        sourceText: p.sourceText ?? '',
        confidence: p.confidence,
      }))
    );
  }

  async extractAndStore(documentId: Types.ObjectId, tenderId: Types.ObjectId) {
    const pageTexts = await this.loadAllPages(documentId);
    const pairs = extractLabelValuePairs(pageTexts, { maxPage: null });
    const result: LabelValueExtractionResult = {
      documentId: String(documentId),
      tenderId: String(tenderId),
      pagesScanned: pageTexts.length,
      totalFound: pairs.length,
      pairs,
    };
    await this.savePairs(documentId, tenderId, result);
    return result;
  }

  async getLabelValuePairs(documentId: string, refresh = false): Promise<LabelValueExtractionResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (!refresh) {
      const stored = await DocumentLabelValuePair.find({ documentId: document._id }).sort({
        pageNumber: 1,
        label: 1,
      });
      if (stored.length) {
        return {
          documentId: String(document._id),
          tenderId: String(document.tenderId),
          pagesScanned: await DocumentPage.countDocuments({ documentId: document._id }),
          totalFound: stored.length,
          pairs: stored.map((p) => ({
            label: p.label,
            value: p.value,
            page: p.pageNumber,
            confidence: p.confidence,
            sourceText: p.sourceText,
          })),
        };
      }
    }

    return this.extractAndStore(document._id, document.tenderId);
  }
}

export const labelValueService = new LabelValueService();
