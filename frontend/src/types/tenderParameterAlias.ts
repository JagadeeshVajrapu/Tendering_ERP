export interface TenderParameterAliasMappingRow {
  parameter: string;
  originalLabel: string;
  canonicalKey: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  aliasMapped: boolean;
}

export interface TenderParameterAliasMappingResult {
  mappings: TenderParameterAliasMappingRow[];
  stats: {
    inputCount: number;
    aliasMappedCount: number;
    unmappedCount: number;
    validatedCount: number;
    rejectedCount: number;
  };
}
