export interface TenderParameterCandidateRow {
  parameter: string;
  originalLabel: string;
  canonicalKey?: string;
  aliasMapped?: boolean;
  rankScore?: number;
  rankWinner?: boolean;
  validationPassed?: boolean;
  validationReason?: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
}

export interface TenderParameterCandidateExtractionResult {
  documentId: string;
  tenderId: string;
  originalName?: string;
  pagesScanned: number;
  chunkSize: number;
  chunksProcessed: number;
  totalCandidates: number;
  candidates: TenderParameterCandidateRow[];
  rankingStats?: {
    inputCount: number;
    winnerCount: number;
    rejectedByContext: number;
    duplicateGroups: number;
  };
  validationStats?: {
    inputCount: number;
    validCount: number;
    rejectedCount: number;
    rejectedByContext: number;
    rejectedByDate: number;
    rejectedByAmount: number;
    rejectedByPeriod: number;
  };
  aiUsed: boolean;
  aiModel?: string;
  extractedAt: string;
}
