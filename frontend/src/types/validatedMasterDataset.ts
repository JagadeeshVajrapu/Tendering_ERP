export interface ValidatedMasterDatasetParameter {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  validationStatus: 'validated' | 'rejected' | 'pending';
  parameterType?: 'core' | 'dynamic';
  category: string;
  canonicalKey?: string;
  originalLabel?: string;
}

export interface ValidatedMasterDatasetResult {
  documentId: string;
  tenderId: string;
  parameters: ValidatedMasterDatasetParameter[];
  statistics: {
    totalParameters: number;
    validatedCount: number;
    coreCount?: number;
    dynamicCount?: number;
    averageConfidence: number;
    categoryCounts: Record<string, number>;
  };
  builtAt: string;
}
