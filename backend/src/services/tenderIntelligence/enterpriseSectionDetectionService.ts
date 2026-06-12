import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { PageText } from '../../types/intelligence';
import { TenderIntelligenceLayer } from '../../models/TenderIntelligenceLayer';
import { ocrPageTextNormalizationService } from '../ocr/ocrPageTextNormalizationService';
import {
  buildSectionExtractionContext,
  detectEnterpriseDocumentSections,
  EnterpriseSectionDetectionResult,
  getEnterpriseSectionDetectionRuleSummary,
} from './enterpriseSectionDetectionEngine';
import { getAllowedSectionsForParameter } from './enterpriseSectionParameterRegistry';

export interface StoredPageClassification {
  page: number;
  primarySection: string;
  primaryConfidence: number;
  sections: Array<{
    section: string;
    confidence: number;
    matchedKeywords: string[];
  }>;
}

class EnterpriseSectionDetectionService {
  async loadCleanPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const { pages } = await ocrPageTextNormalizationService.getCleanPagesForExtraction(documentId);
    return pages;
  }

  detectFromPages(pages: PageText[]): EnterpriseSectionDetectionResult {
    return detectEnterpriseDocumentSections(pages);
  }

  buildExtractionContext(result: EnterpriseSectionDetectionResult): string {
    return buildSectionExtractionContext(result);
  }

  async analyzeAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    pages?: PageText[],
    opts?: { refresh?: boolean }
  ): Promise<EnterpriseSectionDetectionResult & { documentId: string; tenderId: string }> {
    if (!opts?.refresh) {
      const existing = await TenderIntelligenceLayer.findOne({ documentId }).lean();
      if (existing?.pageClassifications?.length) {
        return {
          pageClassifications: existing.pageClassifications as EnterpriseSectionDetectionResult['pageClassifications'],
          documentSections: (existing.sections || []) as EnterpriseSectionDetectionResult['documentSections'],
          pagesScanned: existing.pagesScanned,
          detectedAt: existing.analyzedAt?.toISOString() || new Date().toISOString(),
          documentId: String(documentId),
          tenderId: String(tenderId),
        };
      }
    }

    const pageList = pages?.length ? pages : await this.loadCleanPages(documentId);
    if (!pageList.length) throw new AppError('No OCR pages available for section detection', 400);

    const result = this.detectFromPages(pageList);

    await TenderIntelligenceLayer.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        sections: result.documentSections,
        pageClassifications: result.pageClassifications.map((pc) => ({
          page: pc.page,
          primarySection: pc.primarySection,
          primaryConfidence: pc.primaryConfidence,
          sections: pc.sections.map((s) => ({
            section: s.section,
            confidence: s.confidence,
            matchedKeywords: s.matchedKeywords,
          })),
        })),
        pagesScanned: pageList.length,
        analyzedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log('[EnterpriseSectionDetection] Complete', {
      documentId: String(documentId),
      pages: pageList.length,
      documentSections: result.documentSections.length,
      classifiedPages: result.pageClassifications.length,
    });

    return {
      ...result,
      documentId: String(documentId),
      tenderId: String(tenderId),
    };
  }

  async getForDocument(documentId: string, refresh = false) {
    const docId = new Types.ObjectId(documentId);
    const layer = await TenderIntelligenceLayer.findOne({ documentId: docId }).lean();
    if (!layer) throw new AppError('Section detection not available — run tender analysis first', 404);

    if (refresh || !layer.pageClassifications?.length) {
      return this.analyzeAndStore(docId, layer.tenderId, undefined, { refresh: true });
    }

    return {
      pageClassifications: layer.pageClassifications,
      documentSections: layer.sections,
      pagesScanned: layer.pagesScanned,
      detectedAt: layer.analyzedAt?.toISOString(),
      documentId,
      tenderId: String(layer.tenderId),
    };
  }

  getRuleSummary() {
    return {
      ...getEnterpriseSectionDetectionRuleSummary(),
      parameterSectionExamples: [
        { parameter: 'EMD Amount', primarySection: 'Financial', fallbacks: ['Identity', 'Timeline'] },
        { parameter: 'Bid End Date', primarySection: 'Timeline', fallbacks: ['Financial', 'Identity'] },
        { parameter: 'GST Requirement', primarySection: 'Compliance', fallbacks: ['Eligibility'] },
        { parameter: 'Scope of Work', primarySection: 'Scope', fallbacks: ['Technical Specifications'] },
      ],
      resolveAllowedSections: (parameter: string, canonicalKey?: string) =>
        getAllowedSectionsForParameter(parameter, canonicalKey),
    };
  }
}

export const enterpriseSectionDetectionService = new EnterpriseSectionDetectionService();
