export interface OcrNormalizedRecord {
  label: string;
  value: string;
  page: number;
  sourceText?: string;
}

export interface OcrNormalizationPageSummary {
  page: number;
  recordCount: number;
  characterCount: number;
}

export interface OcrNormalizationResponse {
  documentId: string;
  tenderId: string;
  originalName?: string;
  pagesScanned: number;
  totalRecords: number;
  records: OcrNormalizedRecord[];
  pageSummaries: OcrNormalizationPageSummary[];
}
