import type { MasterDatasetKey } from './masterDataset';

export const PROFESSIONAL_NIT_CATEGORIES = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Tender Specific',
] as const;

export const ADDITIONAL_TENDER_PARAMETERS_CATEGORY = 'Additional Tender Parameters' as const;

export const ALL_NIT_DISPLAY_CATEGORIES = [
  ...PROFESSIONAL_NIT_CATEGORIES,
  ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
] as const;

export type NitConfidenceTier = 'verified' | 'high' | 'review' | 'low';

export type NitValidationDisplay = 'Validated' | 'Dynamic Parameter' | 'Review';

export interface NitAnalysisStatistics {
  totalDiscovered: number;
  totalParametersExtracted?: number;
  mappedCount: number;
  populatedFields: number;
  visibleByDefault?: number;
  totalMasterFields: number;
  coreCount: number;
  dynamicCount: number;
  reviewCount?: number;
  pagesScanned: number;
  averageConfidence: number;
  categoryCounts: Record<string, number>;
  confidenceTierCounts?: Record<string, number>;
  serviceCategory?: string;
  masterDatasetVersion?: number;
}

export interface NitAnalysisFieldRow {
  key: string;
  label: string;
  value: string;
  confidence: number;
  confidenceTier?: NitConfidenceTier;
  confidenceLabel?: string;
  hiddenByDefault?: boolean;
  sourcePage: number;
  extractionMethod?: string;
  category?: string;
  parameterType?: 'core' | 'dynamic';
  validationStatus?: 'validated' | 'review' | 'rejected' | 'pending';
  validationDisplay?: NitValidationDisplay;
  normalizedParameter?: string;
  sourceSection?: string;
  rankingScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface NitAnalysisRiskItem {
  riskType: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  confidence: number;
}

export interface NitAnalysisRiskSummary {
  overallLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  risks: NitAnalysisRiskItem[];
}

export interface NitAnalysisSectionReport {
  id: string;
  title: string;
  intelligenceLabel?: string;
  description: string;
  fields: NitAnalysisFieldRow[];
}

export interface NitAnalysisReport {
  tenderId: string;
  documentId: string;
  originalName?: string;
  generatedAt: string;
  reportType?: 'professional' | 'enterprise_dynamic';
  dataSource: 'validated_master_dataset' | 'master_dataset' | 'enterprise_master_dataset';
  pipeline: { steps: string[] };
  tenderParameters: NitAnalysisFieldRow[];
  sections: NitAnalysisSectionReport[];
  riskSummary?: NitAnalysisRiskSummary;
  statistics: NitAnalysisStatistics;
}

export type NitAnalysisConfidenceFilter = 'all' | NitConfidenceTier;

export type { MasterDatasetKey };
