/** Flat record from Dynamic Parameter Engine — no predefined schema. */
export interface DynamicParameterRecord {
  parameterName: string;
  parameterValue: string;
  sourcePage: number;
  confidence: number;
}

export interface DynamicParameterEngineResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  totalFound: number;
  parameters: DynamicParameterRecord[];
}
