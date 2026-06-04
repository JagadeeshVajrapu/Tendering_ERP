export interface OpenAiVerifiedField {
  fieldName: string;
  verifiedValue: string;
  confidence: number;
  extractedValue?: string;
  sourcePage?: number;
  sourceText?: string;
  correctness?: 'correct' | 'incorrect' | 'uncertain';
  filledMissing?: boolean;
  processingTimeMs?: number;
}

export interface OpenAiVerificationStatistics {
  totalFields: number;
  verifiedCount: number;
  correctedCount: number;
  filledMissingCount: number;
  failedCount: number;
  totalProcessingTimeMs: number;
  model: string;
}

export interface OpenAiVerificationResult {
  verifiedFields: OpenAiVerifiedField[];
  missingFieldsFilled: string[];
  statistics: OpenAiVerificationStatistics;
}
