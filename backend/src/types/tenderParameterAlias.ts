export interface TenderParameterAliasMatch {
  parameter: string;
  originalLabel: string;
  normalizedParameter: string;
  canonicalKey: string;
  mapped: boolean;
  aliasMatched: boolean;
  confidence: number;
  aliasMatchScore: number;
  matchMethod: 'exact_canonical' | 'exact_alias' | 'pattern' | 'semantic' | 'none';
  category?: string;
}

export interface TenderParameterAliasDefinition {
  canonical: string;
  canonicalKey: string;
  aliases: string[];
  patterns: RegExp[];
}

export interface TenderParameterAliasMappingRow {
  parameter: string;
  originalLabel: string;
  normalizedParameter: string;
  canonicalKey: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  aliasMapped: boolean;
  aliasMatchScore: number;
  matchMethod: string;
}

export interface TenderParameterAliasMappingStats {
  inputCount: number;
  aliasMappedCount: number;
  unmappedCount: number;
  validatedCount: number;
  rejectedCount: number;
}

export interface TenderParameterAliasMappingResult {
  mappings: TenderParameterAliasMappingRow[];
  stats: TenderParameterAliasMappingStats;
}
