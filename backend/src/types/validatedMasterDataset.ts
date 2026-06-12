import { MasterParameterGroup } from './masterTenderParameterDictionary';

export type ValidatedParameterStatus = 'validated' | 'review' | 'rejected' | 'pending';

export type MasterDatasetParameterType = 'core' | 'dynamic';

export interface ValidatedMasterDatasetParameter {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  validationStatus: ValidatedParameterStatus;
  category: MasterParameterGroup | string;
  parameterType: MasterDatasetParameterType;
  canonicalKey?: string;
  originalLabel?: string;
}

export interface ValidatedMasterDatasetStatistics {
  totalParameters: number;
  validatedCount: number;
  coreCount: number;
  dynamicCount: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>;
}

export interface ValidatedMasterDatasetResult {
  documentId: string;
  tenderId: string;
  parameters: ValidatedMasterDatasetParameter[];
  statistics: ValidatedMasterDatasetStatistics;
  builtAt: string;
}
