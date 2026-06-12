export type EnterpriseValidationStatus = 'VALID' | 'VALID_DYNAMIC_PARAMETER' | 'REVIEW' | 'REJECT';

export interface EnterpriseAliasValidationRow {
  originalLabel: string;
  parameter: string;
  normalizedParameter: string;
  value: string;
  page: number;
  sourceText: string;
  confidence: number;
  category?: string;
  canonicalKey?: string;
  aliasMapped: boolean;
  aliasMatchMethod: string;
  aliasMatchScore: number;
  isCoreParameter: boolean;
  isDynamicParameter: boolean;
  validationStatus: EnterpriseValidationStatus;
  validationReason: string;
  validationRule?: string;
  validationConfidence: number;
}

export interface EnterpriseAliasValidationResult {
  documentId: string;
  tenderId: string;
  serviceCategory?: string;
  aliasExamples: Array<{
    originalLabel: string;
    normalizedParameter: string;
    aliasMatchMethod: string;
  }>;
  parameters: EnterpriseAliasValidationRow[];
  stats: {
    inputCount: number;
    aliasMappedCount: number;
    validCount: number;
    dynamicCount: number;
    reviewCount: number;
    rejectedCount: number;
    preservedCount: number;
  };
  processedAt: string;
}
