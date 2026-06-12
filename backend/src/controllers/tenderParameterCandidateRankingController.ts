import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { tenderParameterCandidateRankingService } from '../services/tenderParameter/tenderParameterCandidateRankingService';
import { toRankedParameterOutput } from '../services/tenderParameter/enterpriseCandidateRankingDuplicateEngine';
import { getRankingRuleRegistrySummary } from '../services/tenderParameter/enterpriseTenderCandidateRankingEngine';

/** GET /api/debug/:documentId/candidate-ranking — Debug ranking scores and selections */
export const getDocumentCandidateRanking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const result = await tenderParameterCandidateRankingService.rankDocumentCandidates(documentId, {
    refresh,
  });

  const debugGroups = result.combined.selections.map((sel) => ({
    parameter: sel.parameter,
    canonicalKey: sel.canonicalKey,
    selectedValue: sel.selectedValue,
    rankingScore: sel.rankingScore,
    page: sel.page,
    pagePriority: sel.winner.pagePriority,
    sourceSection: sel.winner.sourceSection,
    reason: sel.reason,
    sourceText: sel.sourceText,
    candidateValues: [
      {
        value: sel.winner.value,
        page: sel.winner.page,
        pagePriority: sel.winner.pagePriority,
        sourceSection: sel.winner.sourceSection,
        rankingScore: sel.winner.rankScore,
        selected: true,
        rankBreakdown: sel.winner.rankBreakdown,
        rejectionReason: null,
      },
      ...sel.rejectedCandidates.map((c) => ({
        value: c.value,
        page: c.page,
        pagePriority: c.pagePriority,
        sourceSection: c.sourceSection,
        rankingScore: c.rankScore,
        selected: false,
        rankBreakdown: c.rankBreakdown,
        rejectionReason: c.rankReason,
      })),
    ],
  }));

  sendSuccess(res, {
    documentId: result.documentId,
    stats: result.combined.stats,
    selections: result.combined.selections.map((sel) => ({
      ...sel,
      rankedOutput: toRankedParameterOutput(sel.winner),
    })),
    debugGroups,
    rejectedByRanking: result.combined.rejected.map((r) => ({
      parameter: r.parameter,
      value: r.value,
      page: r.page,
      pagePriority: r.pagePriority,
      sourceSection: r.sourceSection,
      rankingScore: r.rankScore,
      rejectionReason: r.rankReason,
      rankBreakdown: r.rankBreakdown,
    })),
    ruleRegistry: result.ruleRegistry,
  });
});

/** GET /api/tender/foundation/ranking-rules — Ranking rule registry */
export const getFoundationRankingRules = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, getRankingRuleRegistrySummary());
});
