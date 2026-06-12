export const ENTERPRISE_DYNAMIC_EXTRACTION_MODEL = 'enterprise-dynamic-parameter-extraction:v1';

export interface EnterpriseDynamicParameterRow {
  parameter: string;
  value: string;
  page: number;
  sourceText: string;
  confidence: number;
  category: string;
  sectionName?: string;
  isCoreParameter?: boolean;
}

export interface EnterpriseDynamicSectionExtractionInput {
  ocrText: string;
  tenderType: string;
  sectionName: string;
  pages: number[];
}

export interface EnterpriseDynamicSectionExtractionResult {
  sectionName: string;
  tenderType: string;
  pages: number[];
  parameters: EnterpriseDynamicParameterRow[];
  chunksProcessed: number;
}

export interface EnterpriseDynamicParameterExtractionResult {
  documentId: string;
  tenderId: string;
  tenderType: string;
  originalName?: string;
  pagesScanned: number;
  sectionsProcessed: number;
  chunksProcessed: number;
  totalParameters: number;
  knownParameterCount: number;
  unknownParameterCount: number;
  parameters: EnterpriseDynamicParameterRow[];
  sectionResults: EnterpriseDynamicSectionExtractionResult[];
  aiUsed: boolean;
  aiModel?: string;
  extractedAt: string;
}
