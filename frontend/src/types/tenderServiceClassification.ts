export interface TenderServiceClassificationRecord {
  documentId: string;
  tenderId: string;
  serviceCategory: string;
  confidence: number;
  matchedKeywords: string[];
  categoryScores: Record<string, number>;
  pagesScanned: number;
  classifiedAt: string;
}
