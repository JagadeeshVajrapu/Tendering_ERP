export type EnterpriseValidationStatus =
  | 'VALID'
  | 'VALID_DYNAMIC_PARAMETER'
  | 'REVIEW'
  | 'REJECT';

export interface EnterpriseMasterDatasetDuplicateEntry {
  value: string;
  pageNumber: number;
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
  confidence: number;
  validationStatus: EnterpriseValidationStatus;
  isCoreParameter: boolean;
  sourceText: string;
  sourceSection: string;
  rankingScore: number;
  validationReason: string;
  rankingReason: string;
  canonicalKey?: string;
  parameterType: 'core' | 'dynamic';
  duplicateHistory: EnterpriseMasterDatasetDuplicateEntry[];
  schemaVersion: number;
}

export interface EnterpriseMasterDatasetStatistics {
  totalParameters: number;
  coreCount: number;
  dynamicCount: number;
  reviewCount: number;
  validatedCount: number;
  rejectedCount: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>;
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
  versions: Array<{
    version: number;
    parameterCount: number;
    builtAt: string;
    changeSummary?: { added: number; removed: number; valueChanged: number };
  }>;
  builtAt: string;
  dataSource: 'enterprise_master_dataset';
  debug?: EnterpriseMasterDatasetDebugView;
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
