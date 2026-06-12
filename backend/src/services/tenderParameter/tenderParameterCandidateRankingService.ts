import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { documentPageService } from '../ocr/documentPageService';
import { applyEnterpriseAliasToCandidates } from './enterpriseTenderAliasEngine';
import { partitionCoreAndDynamicCandidates } from './tenderParameterCandidatePartition';
import {
  getRankingRuleRegistrySummary,
  rankEnterpriseTenderParameterCandidates,
} from './enterpriseTenderCandidateRankingEngine';
import { EnterpriseCandidateRankingResult } from '../../types/enterpriseTenderCandidateRanking';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';

class TenderParameterCandidateRankingService {
  async rankDocumentCandidates(
    documentId: string,
    opts?: { refresh?: boolean; serviceCategory?: TenderServiceCategory | '' }
  ): Promise<{
    documentId: string;
    core: EnterpriseCandidateRankingResult;
    dynamic: EnterpriseCandidateRankingResult;
    combined: EnterpriseCandidateRankingResult;
    ruleRegistry: ReturnType<typeof getRankingRuleRegistrySummary>;
  }> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const stored = await TenderParameterCandidate.find({ documentId: document._id })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();

    if (!stored.length) throw new AppError('No parameter candidates found for ranking', 404);

    const pages = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
    const pageTexts = documentPageService.toPageText(pages);

    const rawRows = stored.map((s) => ({
      parameter: s.originalLabel || s.parameter,
      value: s.value,
      page: s.pageNumber,
      confidence: s.confidence,
      sourceText: s.sourceText,
      category: s.category,
      isCoreParameter: s.isCoreParameter,
      canonicalKey: s.canonicalKey,
      aliasMapped: !!s.aliasMatchScore,
      aliasMatchScore: s.aliasMatchScore,
      aliasMatchMethod: s.aliasMatchMethod as import('../../types/tenderParameterCandidateExtraction').AliasMatchMethod,
    }));

    const serviceCategory = (opts?.serviceCategory || document.serviceCategory || '') as TenderServiceCategory | '';
    const { candidates: aliasNormalized } = applyEnterpriseAliasToCandidates(rawRows, { serviceCategory });

    const { core, dynamic } = partitionCoreAndDynamicCandidates(aliasNormalized);
    const rankedCore = rankEnterpriseTenderParameterCandidates(core, pageTexts);
    const rankedDynamic = rankEnterpriseTenderParameterCandidates(dynamic, pageTexts);

    const combined: EnterpriseCandidateRankingResult = {
      selections: [...rankedCore.selections, ...rankedDynamic.selections],
      winners: [...rankedCore.winners, ...rankedDynamic.winners],
      rejected: [...rankedCore.rejected, ...rankedDynamic.rejected],
      losers: [...rankedCore.losers, ...rankedDynamic.losers],
      stats: {
        inputCount: rankedCore.stats.inputCount + rankedDynamic.stats.inputCount,
        winnerCount: rankedCore.stats.winnerCount + rankedDynamic.stats.winnerCount,
        rejectedByContext: rankedCore.stats.rejectedByContext + rankedDynamic.stats.rejectedByContext,
        rejectedBySpecialRule:
          rankedCore.stats.rejectedBySpecialRule + rankedDynamic.stats.rejectedBySpecialRule,
        duplicateGroups: rankedCore.stats.duplicateGroups + rankedDynamic.stats.duplicateGroups,
      },
    };

    if (opts?.refresh) {
      const allRanked = [...rankedCore.winners, ...rankedCore.losers, ...rankedCore.rejected, ...rankedDynamic.winners, ...rankedDynamic.losers, ...rankedDynamic.rejected];
      await Promise.all(
        allRanked.map((row) =>
          TenderParameterCandidate.updateOne(
            { documentId: document._id, pageNumber: row.page, parameter: row.parameter, value: row.value },
            {
              $set: {
                rankScore: row.rankScore,
                rankReason: row.rankReason,
                rankBreakdown: row.rankBreakdown,
                rankWinner: row.rankWinner,
                pagePriority: row.pagePriority ?? 0,
                sourceSection: row.sourceSection || '',
                priorityTier: row.priorityTier ?? 0,
              },
            }
          )
        )
      );
    }

    return {
      documentId,
      core: rankedCore,
      dynamic: rankedDynamic,
      combined,
      ruleRegistry: getRankingRuleRegistrySummary(),
    };
  }
}

export const tenderParameterCandidateRankingService = new TenderParameterCandidateRankingService();
