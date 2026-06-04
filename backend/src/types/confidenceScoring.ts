export type ConfidenceExtractionMethod = 'exact' | 'alias' | 'regex' | 'fuzzy' | 'ai_inferred';

export interface ConfidenceValidationInput {
  valid: boolean;
  value?: string;
  reason?: string;
}

export interface ConfidenceAiVerificationInput {
  verifiedValue?: string;
  confidence?: number;
  filledMissing?: boolean;
  correctness?: 'correct' | 'incorrect' | 'uncertain';
}

export interface ConfidenceScoringInput {
  fieldName: string;
  extractedValue: string;
  sourceText: string;
  sourcePage: number;
  extractionMethod?: ConfidenceExtractionMethod;
  validationResult?: ConfidenceValidationInput;
  aiVerificationResult?: ConfidenceAiVerificationInput;
}

export interface ConfidenceScoreBreakdown {
  extractionMethod: ConfidenceExtractionMethod | 'unknown';
  validated: boolean;
  aiVerified: boolean;
  aiConfidence: number | null;
  aiInferred: boolean;
  baseBand: string;
  scoreBeforeAdjustments: number;
  adjustments: string[];
}

export interface ConfidenceScoredField {
  fieldName: string;
  value: string;
  confidence: number;
  confidenceReason: string;
  sourcePage: number;
  sourceText: string;
  lowConfidence: boolean;
  breakdown: ConfidenceScoreBreakdown;
}

export interface ConfidenceScoringStatistics {
  totalFields: number;
  averageConfidence: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  lowConfidenceThreshold: number;
  processingTimeMs: number;
}

export interface ConfidenceScoringResult {
  fields: ConfidenceScoredField[];
  lowConfidenceFields: ConfidenceScoredField[];
  statistics: ConfidenceScoringStatistics;
}

export const LOW_CONFIDENCE_THRESHOLD = 80;
