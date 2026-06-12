import { MasterDatasetKey } from './masterDataset';
import { TenderParameterCandidateRow } from './tenderParameterCandidateExtraction';

export interface EnterpriseRankFactorScores {
  /** Factor 1 — exact=100, alias=95 */
  labelMatch: number;
  /** Factor 2 — proximity to correct parameter labels */
  contextMatch: number;
  /** Factor 3 — NIT, summary, dates, eligibility vs annexure */
  sectionPriority: number;
  /** Factor 4 — pages 1–5 highest; annexure/forms lowest */
  pagePriority: number;
  /** Detected section label (NIT, annexure, etc.) */
  sourceSection?: string;
  /** Priority tier 1–4 */
  priorityTier?: number;
  /** Factor 5 — structured table extraction bonus */
  tableDetection: number;
  /** Factor 6 — clean vs broken OCR */
  ocrQuality: number;
  /** Factor 7 — AI extraction confidence */
  aiConfidence: number;
}

/** Additive enterprise ranking scores (sum = final rank score). */
export interface EnterpriseAdditiveRankScores {
  pageScore: number;
  sectionScore: number;
  aliasScore: number;
  tenderTypeScore: number;
  validationScore: number;
  sourceScore: number;
  aiVerificationScore: number;
  total: number;
  extractionSource: 'AI' | 'RULE' | 'AI+RULE';
}

export interface EnterpriseRankedParameterOutput {
  parameter: string;
  value: string;
  confidence: number;
  source: 'AI' | 'RULE' | 'AI+RULE';
  page: number;
  rankScore: number;
  canonicalKey?: string;
  rankBreakdown?: EnterpriseAdditiveRankScores;
}

export interface EnterpriseRankBreakdown extends EnterpriseRankFactorScores {
  total: number;
  rejected: boolean;
  rejectReason?: string;
  selectionReason?: string;
}

export interface EnterpriseRankedCandidate extends TenderParameterCandidateRow {
  rankScore: number;
  rankBreakdown: EnterpriseRankBreakdown | EnterpriseAdditiveRankScores;
  rankReason: string;
  rankWinner: boolean;
  selectedValue: string;
}

export interface EnterpriseRankingSelection {
  parameter: string;
  canonicalKey?: string;
  selectedValue: string;
  rankingScore: number;
  page: number;
  reason: string;
  sourceText: string;
  winner: EnterpriseRankedCandidate;
  rejectedCandidates: EnterpriseRankedCandidate[];
}

export interface EnterpriseCandidateRankingResult {
  selections: EnterpriseRankingSelection[];
  winners: EnterpriseRankedCandidate[];
  rejected: EnterpriseRankedCandidate[];
  losers: EnterpriseRankedCandidate[];
  stats: {
    inputCount: number;
    winnerCount: number;
    rejectedByContext: number;
    rejectedBySpecialRule: number;
    duplicateGroups: number;
  };
}

export interface RankingSectionRule {
  id: string;
  patterns: RegExp[];
  score: number;
  label: string;
}

export interface RankingSpecialRule {
  parameterKeys: MasterDatasetKey[];
  forbiddenContextPatterns: RegExp[];
  allowedContextPatterns?: RegExp[];
  rejectReason: string;
  description: string;
}

export interface RankingContextLabelRule {
  parameterKeys: MasterDatasetKey[];
  labels: string[];
}
