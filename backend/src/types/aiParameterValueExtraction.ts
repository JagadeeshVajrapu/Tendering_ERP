export interface AiParameterValueRow {
  parameter: string;
  originalLabel?: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  extractionMethod: 'rule' | 'ai';
  aiModel?: string;
}

export interface AiParameterValueExtractionResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  parametersRequested: number;
  totalExtracted: number;
  totalSkipped: number;
  candidates: AiParameterValueRow[];
  aiUsed: boolean;
  aiModel?: string;
  extractedAt: string;
}
