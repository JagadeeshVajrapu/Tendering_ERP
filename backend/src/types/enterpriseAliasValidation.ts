import { EnterpriseValidationStatus } from './enterpriseTenderValidation';
import { AliasMatchMethod } from './tenderParameterCandidateExtraction';

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
  aliasMatchMethod: AliasMatchMethod | '';
  aliasMatchScore: number;
  isCoreParameter: boolean;
  isDynamicParameter: boolean;
  validationStatus: EnterpriseValidationStatus;
  validationReason: string;
  validationRule?: string;
  validationConfidence: number;
}

export interface EnterpriseAliasValidationStats {
  inputCount: number;
  aliasMappedCount: number;
  exactAliasCount: number;
  semanticMatchCount: number;
  unmappedCount: number;
  validCount: number;
  dynamicCount: number;
  reviewCount: number;
  rejectedCount: number;
  preservedCount: number;
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
  stats: EnterpriseAliasValidationStats;
  processedAt: string;
}
