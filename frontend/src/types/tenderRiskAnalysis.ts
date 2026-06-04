export type TenderRiskType =
  | 'Financial Risk'
  | 'Technical Risk'
  | 'Eligibility Risk'
  | 'Timeline Risk'
  | 'Compliance Risk';

export type TenderRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TenderRiskItem {
  riskType: TenderRiskType;
  level: TenderRiskLevel;
  reason: string;
  confidence: number;
}

export interface TenderRiskPrerequisites {
  extractionComplete: boolean;
  validationComplete: boolean;
  masterDatasetReady: boolean;
}

export interface TenderRiskAnalysisResponse {
  tenderId: string;
  documentId: string;
  originalName?: string;
  risks: TenderRiskItem[];
  overallLevel: TenderRiskLevel;
  prerequisites: TenderRiskPrerequisites;
  dataSource: 'master_dataset';
  processingTimeMs: number;
  generatedAt?: string;
  stored?: boolean;
}
