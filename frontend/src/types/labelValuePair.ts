export interface LabelValuePair {
  label: string;
  value: string;
  page: number;
  confidence: number;
  sourceText?: string;
}

export interface LabelValueExtractionResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  totalFound: number;
  pairs: LabelValuePair[];
}
