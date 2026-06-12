import { MasterDatasetKey } from './masterDataset';

export type EnterpriseValidationStatus =
  | 'VALID'
  | 'VALID_DYNAMIC_PARAMETER'
  | 'REVIEW'
  | 'REJECT';

export type EnterpriseVerificationStatus = 'VERIFIED' | 'REVIEW' | 'REJECT';

export interface EnterpriseVerificationScores {
  validationPassed: number;
  pagePriorityMatch: number;
  sectionMatch: number;
  tenderTypeMatch: number;
  aliasMatch: number;
  aiVerification: number;
  total: number;
}

export type EnterpriseMasterDatasetCategory =
  | 'Identity'
  | 'Financial'
  | 'Timeline'
  | 'Eligibility'
  | 'Compliance'
  | 'Experience'
  | 'Scope'
  | 'Tender Specific'
  | 'Additional Tender Parameters';

export interface EnterpriseMasterDatasetDuplicateEntry {
  value: string;
  pageNumber: number;
  pagePriority?: number;
  confidence: number;
  rankingScore: number;
  sourceText: string;
  validationStatus?: string;
}

export interface EnterpriseMasterDatasetEntry {
  id?: string;
  documentId: string;
  tenderId: string;
  parameter: string;
  normalizedParameter: string;
  value: string;
  category: string;
  serviceCategory: string;
  pageNumber: number;
  pagePriority?: number;
  confidence: number;
  validationStatus: EnterpriseValidationStatus;
  isCoreParameter: boolean;
  sourceText: string;
  sourceSection: string;
  rankingScore: number;
  validationReason: string;
  rankingReason: string;
  canonicalKey?: MasterDatasetKey | string;
  parameterType: 'core' | 'dynamic';
  duplicateHistory: EnterpriseMasterDatasetDuplicateEntry[];
  schemaVersion: number;
  tenderType?: string;
  source?: string;
  verificationStatus?: EnterpriseVerificationStatus;
  verificationConfidence?: number;
  verificationReason?: string;
  verificationScores?: EnterpriseVerificationScores;
  verificationAiEvaluated?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnterpriseMasterDatasetStatistics {
  totalParameters: number;
  coreCount: number;
  dynamicCount: number;
  reviewCount: number;
  verifiedCount: number;
  verificationRejectedCount: number;
  validatedCount: number;
  rejectedCount: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>;
}

export interface EnterpriseMasterDatasetVersionInfo {
  version: number;
  parameterCount: number;
  builtAt: string;
  changeSummary?: {
    added: number;
    removed: number;
    valueChanged: number;
  };
}

export interface EnterpriseMasterDatasetResult {
  documentId: string;
  tenderId: string;
  serviceCategory: string;
  schemaVersion: number;
  currentVersion: number;
  parameters: EnterpriseMasterDatasetEntry[];
  rejected: EnterpriseMasterDatasetEntry[];
  statistics: EnterpriseMasterDatasetStatistics;
  versions: EnterpriseMasterDatasetVersionInfo[];
  builtAt: string;
  dataSource: 'enterprise_master_dataset';
}

export interface EnterpriseMasterDatasetDebugView {
  documentId: string;
  extractedParameters: number;
  validatedParameters: EnterpriseMasterDatasetEntry[];
  rejectedParameters: EnterpriseMasterDatasetEntry[];
  storedParameters: EnterpriseMasterDatasetEntry[];
  acceptanceReasons: Array<{ parameter: string; reason: string }>;
  rejectionReasons: Array<{ parameter: string; value: string; reason: string }>;
}
