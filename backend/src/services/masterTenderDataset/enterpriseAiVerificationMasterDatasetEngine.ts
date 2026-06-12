import {
  EnterpriseAiVerificationMasterDatasetSummary,
  MasterDatasetVerificationInput,
  MasterDatasetVerificationResult,
  MasterDatasetVerificationScores,
  MasterDatasetVerificationStatus,
} from '../../types/enterpriseAiVerificationMasterDataset';
import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { matchesTenderTypeLibraryParameter } from '../tenderIntelligence/enterpriseTenderTypeLibraryEngine';
import { resolvePagePriorityAnalysis } from '../tenderParameter/enterprisePagePriorityEngine';
import { normalizeAliasKey } from '../tenderParameter/tenderParameterAliasEngine';
import {
  isHeadingText,
  resolveStrictParameterKind,
  validateStrictParameterRow,
  validateStrictParameterValue,
} from '../tenderParameter/strictValueValidationEngine';
import {
  verifyMasterDatasetParametersWithAi,
  VERIFICATION_QUESTIONS,
} from './enterpriseMasterDatasetAiVerifier';

export const MASTER_VERIFICATION_WEIGHTS = {
  validationPassed: 30,
  pagePriorityMatch: 20,
  sectionMatch: 20,
  tenderTypeMatch: 10,
  aliasMatch: 10,
  aiVerification: 10,
} as const;

export const AUTO_VERIFIED_SCORE_THRESHOLD = 90;
export const VERIFIED_COMBINED_THRESHOLD = 70;
export const REVIEW_COMBINED_THRESHOLD = 50;

const TURNOVER_IN_VALUE_RX =
  /\b(turnover|annual\s+turnover|average\s+turnover|experience|years?\s+of\s+experience|similar\s+work)\b/i;

const SECTION_NAME_VALUE_RX =
  /^(technical|financial|commercial|eligibility|compliance|identity|timeline|scope|experience)$/i;

const SECURITY_DEPOSIT_ONLY_RX = /^security\s+deposit$/i;

const EMD_LABEL_RX = /\b(emd|earnest\s+money(\s+deposit)?)\b/i;
const TENDER_VALUE_LABEL_RX = /\b(tender\s+value|estimated\s+cost|project\s+cost|contract\s+value)\b/i;
const BID_DATE_LABEL_RX = /\b(bid\s+(end|closing|submission)\s*date|last\s+date|submission\s+deadline)\b/i;
const SCOPE_LABEL_RX = /\b(scope\s+of\s+work|work\s+description|services?\s+to\s+be\s+provided)\b/i;

function scoreValidation(input: MasterDatasetVerificationInput): number {
  const status = input.validationStatus;
  if (status === 'REJECT' || input.validationPassed === false) return 0;
  if (status === 'VALID' || status === 'VALID_DYNAMIC_PARAMETER' || input.validationPassed === true) {
    return MASTER_VERIFICATION_WEIGHTS.validationPassed;
  }
  if (status === 'REVIEW') return Math.round(MASTER_VERIFICATION_WEIGHTS.validationPassed / 2);
  return Math.round(MASTER_VERIFICATION_WEIGHTS.validationPassed / 3);
}

function scorePagePriority(input: MasterDatasetVerificationInput): number {
  const analysis = resolvePagePriorityAnalysis(
    input.pageNumber,
    '',
    input.sourceText || ''
  );
  if (analysis.isLowPrioritySection) return 0;
  if (input.pageNumber <= 5) return MASTER_VERIFICATION_WEIGHTS.pagePriorityMatch;
  if (input.pageNumber <= 20) return Math.round(MASTER_VERIFICATION_WEIGHTS.pagePriorityMatch * 0.75);
  if (input.pageNumber <= 50) return Math.round(MASTER_VERIFICATION_WEIGHTS.pagePriorityMatch * 0.5);
  return Math.round(MASTER_VERIFICATION_WEIGHTS.pagePriorityMatch * 0.25);
}

function scoreSection(input: MasterDatasetVerificationInput): number {
  const section = (input.sourceSection || input.sectionName || '').trim();
  if (!section || section === 'general') return Math.round(MASTER_VERIFICATION_WEIGHTS.sectionMatch * 0.25);

  const noiseRx =
    /\b(table\s+of\s+contents|index|annexure|appendix|navigation|header|footer)\b/i;
  if (noiseRx.test(section)) return 0;

  const label = (input.parameter || '').toLowerCase();
  const sectionLower = section.toLowerCase();

  if (label.includes('emd') || label.includes('tender value') || label.includes('bid')) {
    if (/\b(financial|nit|summary|identity|timeline)\b/i.test(sectionLower)) {
      return MASTER_VERIFICATION_WEIGHTS.sectionMatch;
    }
  }
  if (label.includes('scope') && /\b(scope|technical|services)\b/i.test(sectionLower)) {
    return MASTER_VERIFICATION_WEIGHTS.sectionMatch;
  }
  if (label.includes('experience') && /\b(eligibility|experience|qualification)\b/i.test(sectionLower)) {
    return MASTER_VERIFICATION_WEIGHTS.sectionMatch;
  }

  if (section.length > 3) return Math.round(MASTER_VERIFICATION_WEIGHTS.sectionMatch * 0.5);
  return Math.round(MASTER_VERIFICATION_WEIGHTS.sectionMatch * 0.25);
}

function scoreTenderType(input: MasterDatasetVerificationInput): number {
  if (!input.tenderType) return 0;
  if (matchesTenderTypeLibraryParameter(input.parameter, input.tenderType)) {
    return MASTER_VERIFICATION_WEIGHTS.tenderTypeMatch;
  }
  if (input.normalizedParameter && matchesTenderTypeLibraryParameter(input.normalizedParameter, input.tenderType)) {
    return MASTER_VERIFICATION_WEIGHTS.tenderTypeMatch;
  }
  return 0;
}

function scoreAlias(input: MasterDatasetVerificationInput): number {
  if (input.aliasMatchMethod === 'exact_canonical' || input.aliasMatchMethod === 'exact_alias') {
    return MASTER_VERIFICATION_WEIGHTS.aliasMatch;
  }
  if (input.aliasMapped && (input.aliasMatchScore ?? 0) >= 80) {
    return MASTER_VERIFICATION_WEIGHTS.aliasMatch;
  }
  if (input.aliasMapped) return Math.round(MASTER_VERIFICATION_WEIGHTS.aliasMatch * 0.5);

  const original = normalizeAliasKey(input.normalizedParameter || input.parameter);
  const param = normalizeAliasKey(input.parameter);
  if (original !== param && original.length > 2) {
    return Math.round(MASTER_VERIFICATION_WEIGHTS.aliasMatch * 0.75);
  }
  return Math.round(MASTER_VERIFICATION_WEIGHTS.aliasMatch * 0.25);
}

export function computeMasterDatasetVerificationScores(
  input: MasterDatasetVerificationInput,
  aiScore = 0
): MasterDatasetVerificationScores {
  const validationPassed = scoreValidation(input);
  const pagePriorityMatch = scorePagePriority(input);
  const sectionMatch = scoreSection(input);
  const tenderTypeMatch = scoreTenderType(input);
  const aliasMatch = scoreAlias(input);
  const aiVerification = aiScore;

  return {
    validationPassed,
    pagePriorityMatch,
    sectionMatch,
    tenderTypeMatch,
    aliasMatch,
    aiVerification,
    total:
      validationPassed +
      pagePriorityMatch +
      sectionMatch +
      tenderTypeMatch +
      aliasMatch +
      aiVerification,
  };
}

function detectLabelValueMismatch(input: MasterDatasetVerificationInput): string | null {
  const label = input.parameter || '';
  const value = (input.value || '').trim();
  const labelLower = label.toLowerCase();

  if (!value) return 'empty_value';

  if (TENDER_VALUE_LABEL_RX.test(labelLower) && TURNOVER_IN_VALUE_RX.test(value)) {
    return 'Tender Value mapped to turnover or experience text';
  }
  if (EMD_LABEL_RX.test(labelLower) && SECURITY_DEPOSIT_ONLY_RX.test(value)) {
    return 'EMD Amount mapped to generic Security Deposit label';
  }
  if (BID_DATE_LABEL_RX.test(labelLower) && SECTION_NAME_VALUE_RX.test(value)) {
    return 'Bid End Date mapped to section name (Technical/Financial)';
  }
  if (SCOPE_LABEL_RX.test(labelLower) && (isHeadingText(value) || value.split(/\s+/).length <= 2)) {
    return 'Scope Of Work mapped to section heading or fragment';
  }

  const kind = resolveStrictParameterKind(input.canonicalKey, label);
  if (kind) {
    const strict = validateStrictParameterValue(kind, value, input.sourceText || '');
    if (strict.status === 'REJECT') return strict.reason;
  }

  return null;
}

function resolveAiScore(status: MasterDatasetVerificationStatus): number {
  if (status === 'VERIFIED') return MASTER_VERIFICATION_WEIGHTS.aiVerification;
  if (status === 'REVIEW') return Math.round(MASTER_VERIFICATION_WEIGHTS.aiVerification / 2);
  return 0;
}

function resolveFinalStatus(
  deterministicTotal: number,
  aiStatus: MasterDatasetVerificationStatus,
  aiConfidence: number,
  strictReject: boolean
): { status: MasterDatasetVerificationStatus; confidence: number } {
  if (strictReject || aiStatus === 'REJECT') {
    return { status: 'REJECT', confidence: Math.min(aiConfidence, 30) };
  }

  const aiScore = resolveAiScore(aiStatus);
  const combined = deterministicTotal + aiScore;

  if (aiStatus === 'VERIFIED' && combined >= VERIFIED_COMBINED_THRESHOLD) {
    return { status: 'VERIFIED', confidence: Math.max(aiConfidence, combined) };
  }
  if (deterministicTotal >= AUTO_VERIFIED_SCORE_THRESHOLD) {
    return { status: 'VERIFIED', confidence: Math.max(92, combined) };
  }
  if (aiStatus === 'VERIFIED' || combined >= VERIFIED_COMBINED_THRESHOLD) {
    return { status: 'VERIFIED', confidence: Math.max(aiConfidence, combined) };
  }
  if (aiStatus === 'REVIEW' || combined >= REVIEW_COMBINED_THRESHOLD) {
    return { status: 'REVIEW', confidence: Math.max(aiConfidence, combined) };
  }
  return { status: 'REJECT', confidence: Math.min(aiConfidence, combined) };
}

export function verifyMasterDatasetParameterRuleOnly(
  input: MasterDatasetVerificationInput
): MasterDatasetVerificationResult {
  const mismatch = detectLabelValueMismatch(input);
  const strict = validateStrictParameterRow(
    input.canonicalKey,
    input.parameter,
    input.value,
    input.sourceText || ''
  );

  if (mismatch) {
    return {
      parameter: input.parameter,
      value: input.value,
      verificationStatus: 'REJECT',
      verificationConfidence: 0,
      verificationReason: mismatch,
      scores: computeMasterDatasetVerificationScores(input, 0),
      aiEvaluated: false,
      strictValidationStatus: strict?.status,
    };
  }

  const scores = computeMasterDatasetVerificationScores(input, 0);
  if (strict?.status === 'REJECT') {
    return {
      parameter: input.parameter,
      value: input.value,
      verificationStatus: 'REJECT',
      verificationConfidence: scores.total,
      verificationReason: strict.reason,
      scores,
      aiEvaluated: false,
      strictValidationStatus: strict.status,
    };
  }

  if (scores.total >= AUTO_VERIFIED_SCORE_THRESHOLD && strict?.status === 'VALID') {
    return {
      parameter: input.parameter,
      value: input.value,
      verificationStatus: 'VERIFIED',
      verificationConfidence: Math.max(92, scores.total),
      verificationReason: 'High-confidence rule verification',
      scores,
      aiEvaluated: false,
      strictValidationStatus: strict?.status,
    };
  }

  return {
    parameter: input.parameter,
    value: input.value,
    verificationStatus: scores.total >= REVIEW_COMBINED_THRESHOLD ? 'REVIEW' : 'REJECT',
    verificationConfidence: scores.total,
    verificationReason: 'Pending AI verification',
    scores,
    aiEvaluated: false,
    strictValidationStatus: strict?.status,
  };
}

function entryToVerificationInput(
  entry: EnterpriseMasterDatasetEntry,
  row?: TenderParameterCandidateRow,
  tenderType?: string
): MasterDatasetVerificationInput {
  return {
    parameter: entry.parameter,
    normalizedParameter: entry.normalizedParameter,
    value: entry.value,
    pageNumber: entry.pageNumber,
    sourceText: entry.sourceText,
    sourceSection: entry.sourceSection,
    sectionName: row?.sectionName,
    validationStatus: entry.validationStatus,
    validationPassed: entry.validationStatus !== 'REJECT',
    canonicalKey: entry.canonicalKey,
    isCoreParameter: entry.isCoreParameter,
    parameterType: entry.parameterType,
    rankingScore: entry.rankingScore,
    tenderType: tenderType || entry.tenderType,
    aliasMapped: row?.aliasMapped,
    aliasMatchMethod: row?.aliasMatchMethod,
    aliasMatchScore: row?.aliasMatchScore,
  };
}

function applyVerificationToEntry(
  entry: EnterpriseMasterDatasetEntry,
  result: MasterDatasetVerificationResult,
  tenderType?: string
): EnterpriseMasterDatasetEntry {
  const isDynamic =
    entry.parameterType === 'dynamic' || entry.validationStatus === 'VALID_DYNAMIC_PARAMETER';

  let validationStatus = entry.validationStatus;
  if (
    isDynamic &&
    result.verificationStatus === 'VERIFIED' &&
    entry.validationStatus !== 'VALID'
  ) {
    validationStatus = 'VALID_DYNAMIC_PARAMETER';
  }

  return {
    ...entry,
    tenderType: tenderType || entry.tenderType,
    source: entry.source || (entry.isCoreParameter ? 'AI+RULE' : 'AI'),
    confidence: Math.max(entry.confidence, result.verificationConfidence),
    validationStatus,
    verificationStatus: result.verificationStatus,
    verificationConfidence: result.verificationConfidence,
    verificationReason: result.verificationReason,
    verificationScores: result.scores,
    verificationAiEvaluated: result.aiEvaluated,
  };
}

export async function verifyEnterpriseMasterDatasetEntries(
  entries: EnterpriseMasterDatasetEntry[],
  opts?: {
    tenderType?: string;
    candidateRows?: TenderParameterCandidateRow[];
  }
): Promise<{
  stored: EnterpriseMasterDatasetEntry[];
  rejected: EnterpriseMasterDatasetEntry[];
  stats: {
    verifiedCount: number;
    reviewCount: number;
    rejectedCount: number;
    aiEvaluatedCount: number;
  };
}> {
  const candidateByKey = new Map<string, TenderParameterCandidateRow>();
  for (const row of opts?.candidateRows || []) {
    const key = `${row.page}|${normalizeAliasKey(row.parameter)}|${normalizeAliasKey(row.value)}`;
    candidateByKey.set(key, row);
  }

  const ruleResults: Array<{
    entry: EnterpriseMasterDatasetEntry;
    input: MasterDatasetVerificationInput;
    ruleResult: MasterDatasetVerificationResult;
  }> = [];

  for (const entry of entries) {
    const key = `${entry.pageNumber}|${normalizeAliasKey(entry.parameter)}|${normalizeAliasKey(entry.value)}`;
    const row = candidateByKey.get(key);
    const input = entryToVerificationInput(entry, row, opts?.tenderType);
    const ruleResult = verifyMasterDatasetParameterRuleOnly(input);
    ruleResults.push({ entry, input, ruleResult });
  }

  const needsAi = ruleResults.filter(
    ({ ruleResult }) =>
      ruleResult.verificationStatus !== 'VERIFIED' && ruleResult.verificationStatus !== 'REJECT'
  );

  const aiInputs = needsAi.map(({ entry, input }) => ({
    parameter: entry.parameter,
    value: entry.value,
    pageNumber: entry.pageNumber,
    sourceText: entry.sourceText || '',
    sourceSection: entry.sourceSection,
    tenderType: opts?.tenderType,
    validationStatus: entry.validationStatus,
  }));

  const aiResults = await verifyMasterDatasetParametersWithAi(aiInputs);
  const aiByParam = new Map(aiResults.map((r) => [r.parameter.toLowerCase(), r]));

  const stored: EnterpriseMasterDatasetEntry[] = [];
  const rejected: EnterpriseMasterDatasetEntry[] = [];
  let verifiedCount = 0;
  let reviewCount = 0;
  let rejectedCount = 0;
  let aiEvaluatedCount = 0;

  for (const { entry, input, ruleResult } of ruleResults) {
    if (ruleResult.verificationStatus === 'REJECT') {
      rejected.push(
        applyVerificationToEntry(entry, ruleResult, opts?.tenderType)
      );
      rejectedCount += 1;
      continue;
    }

    if (ruleResult.verificationStatus === 'VERIFIED') {
      stored.push(applyVerificationToEntry(entry, ruleResult, opts?.tenderType));
      verifiedCount += 1;
      continue;
    }

    const aiHit = aiByParam.get(entry.parameter.toLowerCase());
    const aiStatus = aiHit?.verificationStatus || 'REVIEW';
    const aiConfidence = aiHit?.confidence ?? 50;
    aiEvaluatedCount += 1;

    const mismatch = detectLabelValueMismatch(input);
    const final = resolveFinalStatus(
      ruleResult.scores.total,
      aiStatus,
      aiConfidence,
      !!mismatch
    );

    const aiScore = resolveAiScore(aiStatus);
    const scores = computeMasterDatasetVerificationScores(input, aiScore);

    const result: MasterDatasetVerificationResult = {
      parameter: entry.parameter,
      value: entry.value,
      verificationStatus: final.status,
      verificationConfidence: final.confidence,
      verificationReason: aiHit?.reason || ruleResult.verificationReason,
      scores,
      aiEvaluated: true,
      strictValidationStatus: ruleResult.strictValidationStatus,
    };

    const verifiedEntry = applyVerificationToEntry(entry, result, opts?.tenderType);

    if (final.status === 'REJECT') {
      rejected.push(verifiedEntry);
      rejectedCount += 1;
    } else if (final.status === 'REVIEW') {
      stored.push(verifiedEntry);
      reviewCount += 1;
    } else {
      stored.push(verifiedEntry);
      verifiedCount += 1;
    }
  }

  return {
    stored: stored.sort((a, b) => a.pageNumber - b.pageNumber || a.parameter.localeCompare(b.parameter)),
    rejected,
    stats: { verifiedCount, reviewCount, rejectedCount, aiEvaluatedCount },
  };
}

export function isStorableVerificationStatus(status?: MasterDatasetVerificationStatus | string): boolean {
  return status === 'VERIFIED' || status === 'REVIEW' || !status;
}

export function getEnterpriseAiVerificationMasterDatasetSummary(): EnterpriseAiVerificationMasterDatasetSummary {
  return {
    engine: 'enterprise_ai_verification_master_dataset',
    weights: { ...MASTER_VERIFICATION_WEIGHTS },
    storeStatuses: ['VERIFIED', 'REVIEW'],
    rejectStatus: 'REJECT',
    verificationExamples: [
      {
        question: VERIFICATION_QUESTIONS[0],
        parameter: 'EMD Amount',
        value: '₹5,00,000',
      },
      {
        question: VERIFICATION_QUESTIONS[1],
        parameter: 'Tender Value',
        value: '₹2.5 Crore',
      },
      {
        question: VERIFICATION_QUESTIONS[2],
        parameter: 'Bid End Date',
        value: '30-Jun-2026',
      },
      {
        question: VERIFICATION_QUESTIONS[3],
        parameter: 'Scope Of Work',
        value: 'Supply of CCTV Systems and installation at designated locations',
      },
    ],
    outputExample: {
      parameter: 'EMD Amount',
      value: '₹5,00,000',
      verificationStatus: 'VERIFIED',
      confidence: 96,
    },
  };
}
