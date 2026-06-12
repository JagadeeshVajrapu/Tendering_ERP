export interface DynamicParameterFilterScores {
  businessRelevance: number;
  tenderTypeMatch: number;
  validationPassed: number;
  aiRelevanceApproved: number;
  total: number;
}

export interface DynamicParameterFilterResult {
  parameter: string;
  value: string;
  category: string;
  status: 'VALID_DYNAMIC' | 'REVIEW' | 'REJECT';
  stored: boolean;
  filterScore: number;
  scores: DynamicParameterFilterScores;
  rejectionReason?: string;
  aiEvaluated?: boolean;
  aiReason?: string;
}

export interface EnterpriseDynamicParameterFilteringSummary {
  engine: string;
  scoreThreshold: number;
  weights: {
    businessRelevance: number;
    tenderTypeMatch: number;
    validationPassed: number;
    aiRelevanceApproved: number;
  };
  allowedCategories: readonly string[];
  rejectedNoiseTypes: string[];
  aiQuestion: string;
  outputExample: DynamicParameterFilterResult;
}
