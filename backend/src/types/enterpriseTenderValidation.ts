import { MasterDatasetKey } from './masterDataset';
import { TenderParameterCandidateRow } from './tenderParameterCandidateExtraction';

export type EnterpriseValidationStatus =
  | 'VALID'
  | 'REVIEW'
  | 'REJECT'
  | 'VALID_DYNAMIC_PARAMETER';

export type EnterpriseValidationLayerId =
  | 'parameter'
  | 'value'
  | 'context'
  | 'logic'
  | 'cross';

export interface EnterpriseValidationLayerResult {
  layer: EnterpriseValidationLayerId;
  status: EnterpriseValidationStatus | 'PASS';
  reason: string;
  rule?: string;
}

export interface EnterpriseValidationResult {
  parameter: string;
  value: string;
  validationStatus: EnterpriseValidationStatus;
  confidence: number;
  reason: string;
  isDynamicParameter: boolean;
  validationRule?: string;
  layers: EnterpriseValidationLayerResult[];
}

export interface EnterpriseValidatedCandidate extends TenderParameterCandidateRow {
  validationStatus: EnterpriseValidationStatus;
  validationPassed: boolean;
  validationReason?: string;
  validationRule?: string;
  validationConfidence: number;
  isDynamicParameter: boolean;
}

export interface EnterpriseValidationRejectionLog {
  parameter: string;
  value: string;
  reason: string;
  page: number;
  validationRule?: string;
  timestamp: string;
}

export interface EnterpriseValidationBatchResult {
  storable: EnterpriseValidatedCandidate[];
  rejected: EnterpriseValidatedCandidate[];
  rejectionLog: EnterpriseValidationRejectionLog[];
  stats: {
    inputCount: number;
    validCount: number;
    reviewCount: number;
    dynamicCount: number;
    rejectedCount: number;
    rejectedByContext: number;
    rejectedByDate: number;
    rejectedByAmount: number;
    rejectedByPeriod: number;
    rejectedByLogic: number;
  };
}

export interface ValueTypeRule {
  parameterKeys: MasterDatasetKey[];
  valueType: 'currency' | 'date' | 'period' | 'percentage' | 'count' | 'text';
}

export interface ContextValidationRule {
  parameterKeys: MasterDatasetKey[];
  nearLabels: string[];
  forbiddenLabels?: string[];
}

export interface LogicValidationRule {
  id: string;
  description: string;
  check: 'date_after' | 'value_not_equal';
  leftKey: MasterDatasetKey;
  rightKey: MasterDatasetKey;
}
