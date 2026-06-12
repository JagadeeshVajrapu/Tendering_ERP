export interface TenderDocumentSection {
  section: string;
  confidence: number;
  pages: number[];
  startPage?: number;
  endPage?: number;
  matchedKeywords: string[];
}

export interface TenderIntelligenceLayerResult {
  tenderType: string;
  confidence: number;
  sections: TenderDocumentSection[];
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  typeScores: Record<string, number>;
  analyzedAt: string;
}
