import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { TenderIntelligenceLayer } from '../../models/TenderIntelligenceLayer';
import { PageText } from '../../types/intelligence';
import { TenderIntelligenceLayerRecord } from '../../types/tenderIntelligenceLayer';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { documentPageService } from '../ocr/documentPageService';
import {
  analyzeTenderIntelligence,
  buildIntelligenceExtractionContext,
} from './tenderIntelligenceLayerEngine';

const TENDER_TYPE_TO_SERVICE_CATEGORY: Partial<Record<string, TenderServiceCategory>> = {
  Manpower: 'Manpower Services',
  Security: 'Security Services',
  Housekeeping: 'Housekeeping Services',
  'Facility Management': 'Facility Management',
  Horticulture: 'Horticulture',
  Civil: 'Civil Works',
  CPWD: 'Civil Works',
  Electrical: 'Electrical Works',
  Mechanical: 'Mechanical Works',
  IT: 'IT Services',
  Supply: 'Supply Tenders',
  Procurement: 'Supply Tenders',
  Consultancy: 'Consultancy',
  Healthcare: 'Healthcare',
  Education: 'Education',
  GeM: 'Supply Tenders',
  Railway: 'Transportation',
};

class TenderIntelligenceLayerService {
  async loadPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  mapTenderTypeToServiceCategory(tenderType: string): TenderServiceCategory | '' {
    return TENDER_TYPE_TO_SERVICE_CATEGORY[tenderType] || '';
  }

  private toRecord(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pagesScanned: number,
    row: {
      tenderType: string;
      confidence: number;
      sections: TenderIntelligenceLayerRecord['sections'];
      pageClassifications?: TenderIntelligenceLayerRecord['pageClassifications'];
      typeScores: Record<string, number>;
      analyzedAt?: Date;
    }
  ): TenderIntelligenceLayerRecord {
    return {
      documentId: String(documentId),
      tenderId: String(tenderId),
      tenderType: row.tenderType as TenderIntelligenceLayerRecord['tenderType'],
      confidence: row.confidence,
      sections: row.sections,
      pageClassifications: row.pageClassifications || [],
      typeScores: row.typeScores,
      pagesScanned,
      analyzedAt: (row.analyzedAt || new Date()).toISOString(),
    };
  }

  async analyzeAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages?: PageText[],
    opts?: { refresh?: boolean }
  ): Promise<TenderIntelligenceLayerRecord> {
    if (!opts?.refresh) {
      const existing = await TenderIntelligenceLayer.findOne({ documentId }).lean();
      if (existing) {
        return this.toRecord(documentId, tenderId, existing.pagesScanned, existing);
      }
    }

    const pageList = pages?.length ? pages : await this.loadPages(documentId);
    if (!pageList.length) throw new AppError('No OCR pages available for tender intelligence analysis', 400);

    const analysis = analyzeTenderIntelligence(pageList);
    const analyzedAt = new Date();

    await TenderIntelligenceLayer.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        tenderType: analysis.tenderType,
        confidence: analysis.confidence,
        sections: analysis.sections,
        typeScores: analysis.typeScores,
        pagesScanned: pageList.length,
        analyzedAt,
      },
      { upsert: true, new: true }
    );

    const mappedCategory = this.mapTenderTypeToServiceCategory(analysis.tenderType);
    if (mappedCategory) {
      await TenderDocument.findByIdAndUpdate(documentId, {
        serviceCategory: mappedCategory,
        serviceClassificationConfidence: analysis.confidence,
      });
    }

    console.log('[TenderIntelligenceLayer] Analyzed', {
      documentId: String(documentId),
      tenderType: analysis.tenderType || 'unclassified',
      confidence: analysis.confidence,
      sections: analysis.sections.map((s) => s.section),
    });

    return this.toRecord(documentId, tenderId, pageList.length, {
      tenderType: analysis.tenderType,
      confidence: analysis.confidence,
      sections: analysis.sections,
      typeScores: analysis.typeScores,
      analyzedAt,
    });
  }

  async getAnalysis(documentId: string, refresh = false): Promise<TenderIntelligenceLayerRecord> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (refresh) {
      return this.analyzeAndStore(document._id, document.tenderId, undefined, { refresh: true });
    }

    const stored = await TenderIntelligenceLayer.findOne({ documentId: document._id }).lean();
    if (stored) {
      return this.toRecord(document._id, document.tenderId, stored.pagesScanned, stored);
    }

    return this.analyzeAndStore(document._id, document.tenderId);
  }

  buildExtractionContext(record: TenderIntelligenceLayerRecord): string {
    return buildIntelligenceExtractionContext(record);
  }
}

export const tenderIntelligenceLayerService = new TenderIntelligenceLayerService();
