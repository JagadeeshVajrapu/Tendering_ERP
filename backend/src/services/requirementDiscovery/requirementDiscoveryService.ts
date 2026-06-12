import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderRequirementChecklist } from '../../models/TenderRequirementChecklist';
import { RequirementDiscoveryResult } from '../../types/requirementDiscovery';
import { documentPageService } from '../ocr/documentPageService';
import { DocumentPage } from '../../models/DocumentPage';
import { tenderServiceClassificationService } from '../tenderClassification/tenderServiceClassificationService';
import { discoverTenderRequirements } from './requirementDiscoveryEngine';

class RequirementDiscoveryService {
  async discoverAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<RequirementDiscoveryResult> {
    if (!opts?.refresh) {
      const existing = await TenderRequirementChecklist.findOne({ documentId }).lean();
      if (existing) {
        return {
          documentId: String(documentId),
          tenderId: String(tenderId),
          serviceCategory: existing.serviceCategory,
          categories: existing.categories as RequirementDiscoveryResult['categories'],
          totalItems: existing.totalItems,
          requiredCount: existing.requiredCount,
          mentionedInTenderCount: existing.mentionedInTenderCount,
          discoveredAt: existing.discoveredAt.toISOString(),
        };
      }
    }

    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    const pageTexts = documentPageService.toPageText(pages);
    if (!pageTexts.length) throw new AppError('No OCR pages available for requirement discovery', 400);

    const classification = await tenderServiceClassificationService.classifyAndStore(
      documentId,
      tenderId,
      pageTexts
    );

    const result = discoverTenderRequirements(
      String(documentId),
      String(tenderId),
      classification.serviceCategory,
      pageTexts
    );

    await TenderRequirementChecklist.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        serviceCategory: result.serviceCategory,
        categories: result.categories,
        totalItems: result.totalItems,
        requiredCount: result.requiredCount,
        mentionedInTenderCount: result.mentionedInTenderCount,
        discoveredAt: new Date(result.discoveredAt),
      },
      { upsert: true, new: true }
    );

    console.log('[RequirementDiscovery] Stored', {
      documentId: String(documentId),
      serviceCategory: result.serviceCategory,
      totalItems: result.totalItems,
      mentionedInTender: result.mentionedInTenderCount,
    });

    return result;
  }

  async getRequirements(documentId: string, refresh = false): Promise<RequirementDiscoveryResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);
    return this.discoverAndStore(document._id, document.tenderId, { refresh });
  }
}

export const requirementDiscoveryService = new RequirementDiscoveryService();
