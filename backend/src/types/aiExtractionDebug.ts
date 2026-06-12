export interface AiExtractionParameterRow {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  sourceSection: string;
  documentId: string;
  originalLabel?: string;
}

export interface AiExtractionComparisonStats {
  aiExtractedCount: number;
  validatedCount: number;
  rejectedCount: number;
  pendingValidationCount: number;
  rankWinnerCount: number;
  rankLoserCount: number;
  masterDatasetCount: number;
  lostInValidation: number;
  lostInRanking: number;
}

export interface AiExtractionDebugResult {
  documentId: string;
  tenderId: string;
  originalName?: string;
  totalExtractedParameters: number;
  aiModel?: string;
  extractedAt?: string;
  pagesScanned: number;
  parameters: AiExtractionParameterRow[];
  comparison: AiExtractionComparisonStats;
}
