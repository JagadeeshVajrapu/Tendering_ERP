/** Single label–value record produced by OCR Normalization Engine. */
export interface OcrNormalizedRecord {
  label: string;
  value: string;
  page: number;
  /** Line snippet for debug / evidence */
  sourceText?: string;
}

export interface OcrNormalizationPageSummary {
  page: number;
  recordCount: number;
  characterCount: number;
}

export interface OcrNormalizationResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  totalRecords: number;
  records: OcrNormalizedRecord[];
  pageSummaries: OcrNormalizationPageSummary[];
}
