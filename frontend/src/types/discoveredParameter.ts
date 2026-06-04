export interface DiscoveredParameterRow {
  id?: string;
  parameterName: string;
  parameterValue: string;
  sourcePage: number;
  confidence: number;
}

export interface AllDiscoveredParametersResponse {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  totalFound: number;
  parameters: DiscoveredParameterRow[];
  originalName?: string;
}
