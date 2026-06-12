import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { TenderAiExtractionSnapshot } from '../../models/TenderAiExtractionSnapshot';
import { EnterpriseMasterDatasetParameter } from '../../models/EnterpriseMasterDatasetParameter';
import { DocumentPage } from '../../models/DocumentPage';
import {
  AiExtractionComparisonStats,
  AiExtractionDebugResult,
  AiExtractionParameterRow,
} from '../../types/aiExtractionDebug';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { tenderParameterCandidateExtractionService } from './tenderParameterCandidateExtractionService';

function toSourceSection(category?: string): string {
  const trimmed = String(category ?? '').trim();
  return trimmed || 'General';
}

class AiExtractionDebugService {
  async persistSnapshot(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    candidates: TenderParameterCandidateRow[],
    aiModel: string
  ): Promise<void> {
    const extractedAt = new Date();
    await TenderAiExtractionSnapshot.deleteMany({ documentId });

    if (!candidates.length) return;

    await TenderAiExtractionSnapshot.insertMany(
      candidates.map((c) => ({
        documentId,
        tenderId,
        parameter: c.parameter,
        originalLabel: c.originalLabel || c.parameter,
        value: c.value,
        pageNumber: c.page,
        confidence: c.confidence,
        sourceText: c.sourceText,
        sourceSection: toSourceSection(c.category),
        aiModel,
        extractedAt,
      }))
    );
  }

  private mapSnapshotRow(
    row: {
      parameter: string;
      originalLabel?: string;
      value: string;
      pageNumber: number;
      confidence: number;
      sourceText: string;
      sourceSection?: string;
      documentId: Types.ObjectId;
    },
    documentId: string
  ): AiExtractionParameterRow {
    return {
      parameter: row.parameter,
      value: row.value,
      page: row.pageNumber,
      confidence: row.confidence,
      sourceText: row.sourceText,
      sourceSection: row.sourceSection || 'General',
      documentId,
      originalLabel: row.originalLabel || row.parameter,
    };
  }

  private async buildComparison(documentId: Types.ObjectId): Promise<AiExtractionComparisonStats> {
    const [candidates, masterDatasetCount, snapshotCount] = await Promise.all([
      TenderParameterCandidate.find({ documentId }).lean(),
      EnterpriseMasterDatasetParameter.countDocuments({ documentId }),
      TenderAiExtractionSnapshot.countDocuments({ documentId }),
    ]);

    const aiExtractedCount = snapshotCount || candidates.length;
    const validatedCount = candidates.filter((c) => c.validationPassed === true).length;
    const rejectedCount = candidates.filter((c) => c.validationPassed === false).length;
    const pendingValidationCount = candidates.filter((c) => c.validationPassed == null).length;
    const rankWinnerCount = candidates.filter((c) => c.rankWinner === true).length;
    const rankLoserCount = candidates.filter((c) => c.rankWinner === false).length;

    return {
      aiExtractedCount,
      validatedCount,
      rejectedCount,
      pendingValidationCount,
      rankWinnerCount,
      rankLoserCount,
      masterDatasetCount,
      lostInValidation: Math.max(0, aiExtractedCount - validatedCount - pendingValidationCount),
      lostInRanking: Math.max(0, aiExtractedCount - rankWinnerCount - pendingValidationCount),
    };
  }

  async getDashboard(documentId: string, refresh = false): Promise<AiExtractionDebugResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (refresh) {
      await tenderParameterCandidateExtractionService.extractAndStore(
        document._id,
        document.tenderId,
        { refresh: true }
      );
    }

    const [snapshotRows, pageCount] = await Promise.all([
      TenderAiExtractionSnapshot.find({ documentId: document._id })
        .sort({ pageNumber: 1, parameter: 1 })
        .lean(),
      DocumentPage.countDocuments({ documentId: document._id }),
    ]);

    let parameters: AiExtractionParameterRow[];
    let aiModel: string | undefined;
    let extractedAt: string | undefined;

    if (snapshotRows.length) {
      parameters = snapshotRows.map((row) =>
        this.mapSnapshotRow(row, String(document._id))
      );
      aiModel = snapshotRows[0]?.aiModel;
      extractedAt = snapshotRows[0]?.extractedAt?.toISOString();
    } else {
      const extraction = await tenderParameterCandidateExtractionService.getCandidates(documentId, false);
      parameters = extraction.candidates.map((c) => ({
        parameter: c.parameter,
        value: c.value,
        page: c.page,
        confidence: c.confidence,
        sourceText: c.sourceText,
        sourceSection: toSourceSection(c.category),
        documentId: String(document._id),
        originalLabel: c.originalLabel,
      }));
      aiModel = extraction.aiModel;
      extractedAt = extraction.extractedAt;

      if (parameters.length) {
        await this.persistSnapshot(
          document._id,
          document.tenderId,
          extraction.candidates,
          aiModel || 'unknown'
        );
      }
    }

    const comparison = await this.buildComparison(document._id);

    return {
      documentId: String(document._id),
      tenderId: String(document.tenderId),
      originalName: document.originalName,
      totalExtractedParameters: parameters.length,
      aiModel,
      extractedAt,
      pagesScanned: pageCount,
      parameters,
      comparison,
    };
  }
}

export const aiExtractionDebugService = new AiExtractionDebugService();
