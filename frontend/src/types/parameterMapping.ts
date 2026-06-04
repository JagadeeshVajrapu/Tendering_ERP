import type { MasterDatasetKey } from './masterDataset';

export interface MappedBusinessField {
  masterKey: MasterDatasetKey;
  businessFieldName: string;
  value: string;
  sourceParameterName: string;
  sourcePage: number;
  confidence: number;
  sourceText: string;
  mappingRule: string;
}

export interface UnmappedDiscoveredParameter {
  parameterName: string;
  parameterValue: string;
  sourcePage: number;
  confidence: number;
}

export interface MappingExample {
  sourceParameters: string[];
  masterField: string;
  masterKey: MasterDatasetKey;
}

export interface ParameterMappingResult {
  documentId: string;
  tenderId: string;
  totalDiscovered: number;
  mappedCount: number;
  mappedFields: MappedBusinessField[];
  unmappedCount: number;
  unmappedParameters?: UnmappedDiscoveredParameter[];
  mappingTable?: Array<{
    sourceParameter: string;
    businessFieldName: string;
    masterKey: MasterDatasetKey;
  }>;
  mappingExamples?: MappingExample[];
}
