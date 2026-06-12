import { DynamicParameterRecord } from './dynamicParameter';
import { MasterDatasetKey } from './masterDataset';

/** Legacy verified-summary rows for empty master fields */
export const NOT_FOUND_VALUE = 'Not Found';

export interface DiscoveredParameterRow extends DynamicParameterRecord {
  /** Unique React list key */
  id: string;
}

export type NitConfidenceTier = 'verified' | 'high' | 'review' | 'low';

export type NitValidationDisplay = 'Validated' | 'Dynamic Parameter' | 'Review';

export interface NitAnalysisStatistics {
  totalDiscovered: number;
  /** Primary headline count — all validated parameters in the report */
  totalParametersExtracted?: number;
  mappedCount: number;
  populatedFields: number;
  /** Parameters visible when low-confidence rows are hidden (confidence ≥ 70) */
  visibleByDefault?: number;
  totalMasterFields: number;
  coreCount: number;
  dynamicCount: number;
  reviewCount?: number;
  pagesScanned: number;
  averageConfidence: number;
  /** Count per professional category, e.g. { Identity: 5, "Additional Tender Parameters": 14 } */
  categoryCounts: Record<string, number>;
  confidenceTierCounts?: Record<string, number>;
  serviceCategory?: string;
  masterDatasetVersion?: number;
}

export interface NitAnalysisPipelineInfo {
  steps: string[];
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
  /** Built exclusively from master dataset — never raw OCR or candidate tables */
  dataSource: 'validated_master_dataset' | 'master_dataset' | 'enterprise_master_dataset';
  pipeline: NitAnalysisPipelineInfo;
  /** Validated parameters only (dictionary-approved names) */
  tenderParameters: NitAnalysisFieldRow[];
  /** Professional sections: Identity → … → Risk */
  sections: NitAnalysisSectionReport[];
  riskSummary?: NitAnalysisRiskSummary;
  statistics: NitAnalysisStatistics;
}
