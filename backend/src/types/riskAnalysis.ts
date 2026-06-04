export type RiskCategory =
  | 'Financial Risk'
  | 'Technical Risk'
  | 'Eligibility Risk'
  | 'Timeline Risk';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface RiskAnalysisItem {
  category: RiskCategory;
  level: RiskLevel;
  explanation: string;
  confidence: number;
}

export interface RiskAnalysisPrerequisites {
  ocrComplete: boolean;
  ruleExtractionComplete: boolean;
  validationComplete: boolean;
  openAiVerificationComplete: boolean;
}

export interface RiskAnalysisResult {
  items: RiskAnalysisItem[];
  overallLevel: RiskLevel;
  prerequisites: RiskAnalysisPrerequisites;
  processingTimeMs: number;
}
