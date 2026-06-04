/** Single field in the master tender dataset (source of truth). */
export interface MasterDatasetField {
  value: string;
  confidence: number;
  sourcePage: number;
  sourceText: string;
  extractionMethod?: string;
}

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

export type MasterTenderDataset = Record<MasterDatasetKey, MasterDatasetField>;

export const MASTER_DATASET_KEYS: MasterDatasetKey[] = [
  'tenderNumber',
  'nitNumber',
  'bidReferenceNumber',
  'department',
  'organization',
  'tenderTitle',
  'workName',
  'location',
  'district',
  'state',
  'country',
  'estimatedCost',
  'tenderValue',
  'emdAmount',
  'documentFee',
  'publishingDate',
  'bidStartDate',
  'bidEndDate',
  'technicalBidDate',
  'financialBidDate',
  'preBidMeetingDate',
  'contactName',
  'contactDesignation',
  'contactEmail',
  'contactPhone',
  'eligibilityCriteria',
  'experienceRequirement',
  'turnoverRequirement',
  'manpowerRequirement',
  'equipmentRequirement',
  'completionPeriod',
  'contractPeriod',
  'performanceSecurity',
  'paymentTerms',
  'penaltyClauses',
  'certificates',
  'scopeOfWork',
];

export interface MasterDatasetStatistics {
  totalFields: number;
  populatedFields: number;
  averageConfidence: number;
  lowConfidenceFields: number;
  processingTimeMs: number;
}

export interface MasterDatasetBuildResult {
  dataset: MasterTenderDataset;
  statistics: MasterDatasetStatistics;
}

export interface MasterDatasetProvenance {
  ocrPageCount: number;
  ruleExtractedCount: number;
  validatedCount: number;
  aiVerifiedCount: number;
  confidenceScoredCount: number;
  fieldLocatorCount?: number;
}
