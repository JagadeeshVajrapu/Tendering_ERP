import type { LabelValueExtractionResult } from './labelValuePair';

export type CanonicalFieldName =
  | 'Tender Number'
  | 'Organization'
  | 'EMD'
  | 'Tender Value'
  | 'Name of Work';

export interface MappedLabelValueField {
  targetField: CanonicalFieldName;
  value: string;
  sourceLabel: string;
  page: number;
  confidence: number;
  sourceText?: string;
  mappingRule: string;
}

export interface LabelMappingTableRow {
  sourceLabel: string;
  targetField: CanonicalFieldName;
}

export interface LabelValueMappingResult {
  documentId: string;
  tenderId: string;
  extraction: LabelValueExtractionResult;
  mappedFields: MappedLabelValueField[];
  mappingTable: LabelMappingTableRow[];
}
