export type OcrDocumentType = 'digital_pdf' | 'scanned_pdf' | 'docx' | 'image';

export type OcrExtractionMethod = 'pdf-parse' | 'textract' | 'mammoth';

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  characterCount: number;
}

export interface OcrQualityMetrics {
  pages: number;
  totalCharacters: number;
  averageCharactersPerPage: number;
  qualityScore: number;
}

export interface DocumentOcrResult {
  detectedType: OcrDocumentType;
  extractionMethod: OcrExtractionMethod;
  pages: OcrPageResult[];
  metrics: OcrQualityMetrics;
  processingTimeMs: number;
}
