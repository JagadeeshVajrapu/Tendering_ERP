export type ExecutiveRecommendation =
  | 'Apply Immediately'
  | 'Apply With Caution'
  | 'Need Manual Review'
  | 'Do Not Apply';

export type FactorStatus = 'Favorable' | 'Neutral' | 'Concern' | 'Critical';

export interface RecommendationFactor {
  factor:
    | 'Tender Value'
    | 'EMD'
    | 'Eligibility Criteria'
    | 'Turnover Requirements'
    | 'Experience Requirements'
    | 'Timeline'
    | 'Compliance';
  status: FactorStatus;
  summary: string;
  detail: string;
  confidence: number | null;
  sourcePage: number | null;
}

export interface ExecutiveRecommendationResponse {
  tenderId: string;
  documentId: string;
  originalName?: string;
  recommendation: ExecutiveRecommendation;
  executiveSummary: string;
  factors: RecommendationFactor[];
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataQualityScore: number;
  dataSource: 'master_dataset';
  processingTimeMs: number;
  generatedAt?: string;
  stored?: boolean;
}
