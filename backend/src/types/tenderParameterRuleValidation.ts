import { TenderParameterCandidateRow } from './tenderParameterCandidateExtraction';

export interface TenderParameterRuleValidationResult {
  valid: boolean;
  reason?: string;
  rule?: string;
}

export interface ValidatedTenderParameterCandidate extends TenderParameterCandidateRow {
  validationPassed: boolean;
  validationReason?: string;
  validationRule?: string;
}

export interface TenderParameterRuleValidationBatchResult {
  valid: ValidatedTenderParameterCandidate[];
  rejected: ValidatedTenderParameterCandidate[];
  stats: {
    inputCount: number;
    validCount: number;
    rejectedCount: number;
    rejectedByContext: number;
    rejectedByDate: number;
    rejectedByAmount: number;
    rejectedByPeriod: number;
  };
}
