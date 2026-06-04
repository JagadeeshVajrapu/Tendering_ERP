export interface DetectedFieldCandidate {
  fieldName: string;
  candidateValue: string;
  sourcePage: number;
  sourceText: string;
  detectionMethod?: string;
  confidence?: number;
}

export interface CandidateDetectionStatistics {
  totalCandidates: number;
  byField: Record<string, number>;
  pagesScanned: number;
  processingTimeMs: number;
}

export interface CandidateDetectionResult {
  candidates: DetectedFieldCandidate[];
  statistics: CandidateDetectionStatistics;
}
