export interface DynamicMasterDatasetParameter {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  category: string;
  validationStatus: string;
  sourceText: string;
  parameterType: 'core' | 'dynamic';
  canonicalKey?: string;
  originalLabel?: string;
}

export interface DynamicMasterDatasetResult {
  documentId: string;
  tenderId: string;
  serviceCategory: string;
  schemaVersion: number;
  currentVersion: number;
  coreParameters: DynamicMasterDatasetParameter[];
  dynamicParameters: DynamicMasterDatasetParameter[];
  parameters: DynamicMasterDatasetParameter[];
  statistics: {
    totalParameters: number;
    coreCount: number;
    dynamicCount: number;
    reviewCount: number;
    validatedCount: number;
    categoryCounts: Record<string, number>;
    averageConfidence: number;
  };
  builtAt: string;
  dataSource: string;
}
