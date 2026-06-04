import { DynamicParameterRecord } from './dynamicParameter';
import { MasterDatasetKey } from './masterDataset';

/** Legacy verified-summary rows for empty master fields */
export const NOT_FOUND_VALUE = 'Not Found';

export interface DiscoveredParameterRow extends DynamicParameterRecord {
  /** Unique React list key */
  id: string;
}

export interface NitAnalysisStatistics {
  totalDiscovered: number;
  mappedCount: number;
  populatedFields: number;
  totalMasterFields: number;
  pagesScanned: number;
  averageConfidence: number;
}

export interface NitAnalysisPipelineInfo {
  steps: string[];
}

export interface NitAnalysisFieldRow {
  key: MasterDatasetKey;
  label: string;
  value: string;
  confidence: number;
  sourcePage: number;
  sourceText: string;
  extractionMethod?: string;
}

export interface NitAnalysisSectionReport {
  id: string;
  title: string;
  description: string;
  fields: NitAnalysisFieldRow[];
}

export interface NitAnalysisReport {
  tenderId: string;
  documentId: string;
  originalName?: string;
  generatedAt: string;
  /** NIT view is built from mapped master dataset fields */
  dataSource: 'master_dataset';
  pipeline: NitAnalysisPipelineInfo;
  /** Flat list of mapped tender fields (primary UI) — populated values only */
  tenderParameters: NitAnalysisFieldRow[];
  /** Populated business fields grouped by NIT section */
  sections: NitAnalysisSectionReport[];
  statistics: NitAnalysisStatistics;
}
