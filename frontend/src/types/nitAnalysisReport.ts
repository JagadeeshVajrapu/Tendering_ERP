import type { MasterDatasetKey } from './masterDataset';

export interface NitAnalysisStatistics {
  totalDiscovered: number;
  mappedCount: number;
  populatedFields: number;
  totalMasterFields: number;
  pagesScanned: number;
  averageConfidence: number;
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
  dataSource: 'master_dataset';
  pipeline: { steps: string[] };
  tenderParameters: NitAnalysisFieldRow[];
  sections: NitAnalysisSectionReport[];
  statistics: NitAnalysisStatistics;
}
