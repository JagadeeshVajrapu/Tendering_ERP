import { TenderParameterCandidateRow } from './tenderParameterCandidateExtraction';
import { EnterpriseValidatedCandidate } from './enterpriseTenderValidation';

export type DiscoveredParameterCategory =
  | 'Identity'
  | 'Financial'
  | 'Timeline'
  | 'Eligibility'
  | 'Compliance'
  | 'Experience'
  | 'Scope'
  | 'Technical'
  | 'Tender Specific'
  | 'Additional Tender Parameters';

export interface DiscoveredDynamicParameter extends TenderParameterCandidateRow {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  category: DiscoveredParameterCategory | string;
  isCoreParameter: false;
  validationStatus: 'VALID_DYNAMIC_PARAMETER' | 'REVIEW' | 'REJECT';
  sourceText: string;
  validationPassed: boolean;
  aiEvaluated?: boolean;
  aiReason?: string;
  discoveryMethod?: 'registry' | 'learning' | 'ai' | 'rules';
}

export interface DynamicParameterAiEvaluation {
  parameter: string;
  genuine: boolean;
  category: string;
  confidence: number;
  reason: string;
}

export interface DiscoveredParameterLearningEntry {
  parameterKey: string;
  parameterName: string;
  category: string;
  serviceCategories: string[];
  frequency: number;
  examples: string[];
  aliasSuggestions: string[];
  promotedToCore: boolean;
  promotedAt?: string;
  lastSeenAt: string;
}

export interface EnterpriseDynamicDiscoveryResult {
  documentId: string;
  tenderId: string;
  serviceCategory: string;
  coreParameters: EnterpriseValidatedCandidate[];
  discovered: DiscoveredDynamicParameter[];
  rejected: DiscoveredDynamicParameter[];
  promoted: DiscoveredParameterLearningEntry[];
  stats: {
    inputDynamicCount: number;
    discoveredCount: number;
    rejectedCount: number;
    aiEvaluatedCount: number;
    registryMatchCount: number;
    learningMatchCount: number;
  };
  discoveredAt: string;
}
