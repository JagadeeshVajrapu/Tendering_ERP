export type MasterDatasetKey =
  | 'tenderNumber'
  | 'nitNumber'
  | 'bidReferenceNumber'
  | 'department'
  | 'organization'
  | 'tenderTitle'
  | 'workName'
  | 'location'
  | 'district'
  | 'state'
  | 'country'
  | 'estimatedCost'
  | 'tenderValue'
  | 'emdAmount'
  | 'documentFee'
  | 'publishingDate'
  | 'bidStartDate'
  | 'bidEndDate'
  | 'technicalBidDate'
  | 'financialBidDate'
  | 'preBidMeetingDate'
  | 'contactName'
  | 'contactDesignation'
  | 'contactEmail'
  | 'contactPhone'
  | 'eligibilityCriteria'
  | 'experienceRequirement'
  | 'turnoverRequirement'
  | 'manpowerRequirement'
  | 'equipmentRequirement'
  | 'completionPeriod'
  | 'contractPeriod'
  | 'performanceSecurity'
  | 'paymentTerms'
  | 'penaltyClauses'
  | 'certificates'
  | 'scopeOfWork';

export interface MasterDatasetField {
  value: string;
  confidence: number;
  sourcePage: number;
  sourceText: string;
  validationResult: string;
  extractionMethod: string;
}

export type MasterTenderDataset = Record<MasterDatasetKey, MasterDatasetField>;

export interface MasterDatasetStatistics {
  totalFields: number;
  populatedFields: number;
  averageConfidence: number;
  lowConfidenceFields: number;
  processingTimeMs: number;
}

export interface MasterDatasetProvenance {
  ocrPageCount: number;
  ruleExtractedCount: number;
  validatedCount: number;
  aiVerifiedCount: number;
  confidenceScoredCount: number;
}

export interface MasterTenderDatasetResponse {
  tenderId: string;
  documentId: string;
  originalName?: string;
  schemaVersion: number;
  singleSourceOfTruth: boolean;
  statistics: MasterDatasetStatistics;
  provenance: MasterDatasetProvenance;
  dataset: MasterTenderDataset;
  populatedFields: MasterDatasetKey[];
  lowConfidenceFields: Array<{ field: MasterDatasetKey } & MasterDatasetField>;
}

export type DatasetFilterMode = 'all' | 'populated' | 'low_confidence' | 'missing';

export interface DatasetRowView {
  key: MasterDatasetKey;
  parameter: string;
  sectionId: string;
  sectionTitle: string;
  field: MasterDatasetField;
}
