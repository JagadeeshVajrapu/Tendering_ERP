import { ProductionFieldDefinition, isMoneyType, isDateType } from '../fieldDefinitions';
import { FieldCandidate } from '../fieldLevelExtractor';
import {
  scoreDurationCandidate,
  shouldRejectDurationCandidate,
} from './durationRanker';
import { scoreMoneyCandidate, shouldRejectMoneyCandidate } from './moneyRanker';
import {
  scoreTenderIdCandidate,
  shouldRejectTenderIdCandidate,
} from './tenderIdRanker';
import {
  scoreSubmissionModeCandidate,
  shouldRejectSubmissionModeCandidate,
} from './submissionModeRanker';

const MONEY_FIELD_IDS = new Set([
  'emdAmount',
  'estimatedTenderValue',
  'tenderFee',
  'performanceSecurity',
  'bankGuarantee',
  'bidSecurityAmount',
  'estimatedCost',
  'securityDeposit',
]);

const TENDER_ID_FIELD_IDS = new Set(['tenderNumber', 'tenderReferenceNumber']);

export function applyFieldRanker(
  def: ProductionFieldDefinition,
  candidate: FieldCandidate,
  sourceText: string
): { rankBonus: number; reject: boolean } {
  if (def.id === 'contractDuration' || def.valueType === 'duration') {
    if (shouldRejectDurationCandidate(candidate, sourceText)) {
      return { rankBonus: -1000, reject: true };
    }
    return { rankBonus: scoreDurationCandidate(candidate, sourceText), reject: false };
  }

  if (MONEY_FIELD_IDS.has(def.id) || isMoneyType(def.valueType)) {
    if (shouldRejectMoneyCandidate(def, candidate, sourceText)) {
      return { rankBonus: -1000, reject: true };
    }
    return { rankBonus: scoreMoneyCandidate(def, candidate, sourceText), reject: false };
  }

  if (TENDER_ID_FIELD_IDS.has(def.id)) {
    if (shouldRejectTenderIdCandidate(candidate)) {
      return { rankBonus: -1000, reject: true };
    }
    return { rankBonus: scoreTenderIdCandidate(candidate, sourceText), reject: false };
  }

  if (def.id === 'submissionMode' || def.id === 'bidSystem') {
    if (shouldRejectSubmissionModeCandidate(candidate, sourceText)) {
      return { rankBonus: -1000, reject: true };
    }
    return { rankBonus: scoreSubmissionModeCandidate(candidate, sourceText), reject: false };
  }

  if (isDateType(def.valueType)) {
    let bonus = 0;
    if (/last\s+date|submission|opening|due\s+date/i.test(sourceText)) bonus += 20;
    if (candidate.source === 'table') bonus += 10;
    return { rankBonus: bonus, reject: false };
  }

  if (
    ['turnoverRequirements', 'experienceRequirements'].includes(def.id) &&
    candidate.source === 'table'
  ) {
    return { rankBonus: 25, reject: false };
  }

  return { rankBonus: 0, reject: false };
}
