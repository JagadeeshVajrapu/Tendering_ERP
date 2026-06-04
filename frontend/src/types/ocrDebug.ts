export interface OcrDebugPage {
  pageNumber: number;
  extractedText: string;
  extractionMethod: string;
  characterCount: number;
}

export interface OcrQualityMetrics {
  pages: number;
  totalCharacters: number;
  averageCharactersPerPage: number;
  qualityScore: number;
}

export interface OcrDebugPagesResponse {
  documentId: string;
  tenderId: string;
  originalName?: string;
  mimeType?: string;
  detectedType?: string;
  documentExtractionMethod?: string;
  processingTimeMs: number | null;
  qualityMetrics: OcrQualityMetrics;
  qualityThreshold: number;
  passesQualityGate: boolean;
  pageCount: number;
  pages: OcrDebugPage[];
}
