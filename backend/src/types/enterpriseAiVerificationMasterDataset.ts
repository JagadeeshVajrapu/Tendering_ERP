export type MasterDatasetVerificationStatus = 'VERIFIED' | 'REVIEW' | 'REJECT';

export interface MasterDatasetVerificationScores {
  validationPassed: number;
  pagePriorityMatch: number;
  sectionMatch: number;
  tenderTypeMatch: number;
  aliasMatch: number;
  aiVerification: number;
  total: number;
}

export interface MasterDatasetVerificationInput {
  parameter: string;
  normalizedParameter?: string;
  value: string;
  pageNumber: number;
  sourceText?: string;
  sourceSection?: string;
  sectionName?: string;
  validationStatus?: string;
  validationPassed?: boolean;
  canonicalKey?: string;
  isCoreParameter?: boolean;
  parameterType?: 'core' | 'dynamic';
  rankingScore?: number;
  tenderType?: string;
  aliasMapped?: boolean;
  aliasMatchMethod?: string;
  aliasMatchScore?: number;
}

export interface MasterDatasetVerificationResult {
  parameter: string;
  value: string;
  verificationStatus: MasterDatasetVerificationStatus;
  verificationConfidence: number;
  verificationReason?: string;
  scores: MasterDatasetVerificationScores;
  aiEvaluated: boolean;
  strictValidationStatus?: string;
}

export interface EnterpriseAiVerificationMasterDatasetSummary {
  engine: string;
  weights: {
    validationPassed: number;
    pagePriorityMatch: number;
    sectionMatch: number;
    tenderTypeMatch: number;
    aliasMatch: number;
    aiVerification: number;
  };
  storeStatuses: MasterDatasetVerificationStatus[];
  rejectStatus: MasterDatasetVerificationStatus;
  verificationExamples: Array<{
    question: string;
    parameter: string;
    value: string;
  }>;
  outputExample: {
    parameter: string;
    value: string;
    verificationStatus: MasterDatasetVerificationStatus;
    confidence: number;
  };
}
