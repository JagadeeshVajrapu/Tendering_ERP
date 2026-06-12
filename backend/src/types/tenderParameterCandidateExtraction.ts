export const STEP1_CANDIDATE_AI_MODEL = 'ai-parameter-discovery-extraction:v1';

export type TenderParameterExtractionCategory =
  | 'Identity'
  | 'Financial'
  | 'Timeline'
  | 'Eligibility'
  | 'Compliance'
  | 'Experience'
  | 'Scope'
  | 'Tender Specific'
  | 'General';

export interface RawTenderParameterCandidateRow {
  parameter: string;
  value: string;
  page: number;
  confidence: number;
  sourceText: string;
  category?: string;
  isCoreParameter?: boolean;
  pagePriority?: number;
  priorityTier?: number;
  sourceSection?: string;
}

export type AliasMatchMethod = 'exact_canonical' | 'exact_alias' | 'pattern' | 'semantic' | 'none';

export interface TenderParameterCandidateRow extends RawTenderParameterCandidateRow {
  parameter: string;
  originalLabel: string;
  normalizedParameter?: string;
  canonicalKey?: string;
  aliasMapped?: boolean;
  aliasMatchScore?: number;
  aliasMatchMethod?: AliasMatchMethod;
  category?: string;
  isCoreParameter?: boolean;
  rankScore?: number;
  rankReason?: string;
  rankBreakdown?: unknown;
  rankWinner?: boolean;
  validationPassed?: boolean | null;
  validationStatus?: 'VALID' | 'REVIEW' | 'REJECT' | 'VALID_DYNAMIC_PARAMETER';
  validationReason?: string;
  validationRule?: string;
  validationConfidence?: number;
  isDynamicParameter?: boolean;
  chunkStartPage?: number;
  chunkEndPage?: number;
  pagePriority?: number;
  priorityTier?: number;
  sourceSection?: string;
  sectionName?: string;
  sectionConfidence?: number;
}

export interface TenderParameterExtractionMetadata {
  documentName?: string;
  tenderTitle?: string;
  serviceCategory?: string;
  classificationConfidence?: number;
  tenderType?: string;
  intelligenceConfidence?: number;
  documentSections?: Array<{
    section: string;
    confidence: number;
    startPage?: number;
    endPage?: number;
  }>;
}

export interface TenderParameterCandidateExtractionResult {
  documentId: string;
  tenderId: string;
  originalName?: string;
  pagesScanned: number;
  chunkSize: number;
  chunksProcessed: number;
  totalCandidates: number;
  candidates: TenderParameterCandidateRow[];
  rankingStats?: {
    inputCount: number;
    winnerCount: number;
    rejectedByContext: number;
    duplicateGroups: number;
  };
  validationStats?: {
    inputCount: number;
    validCount: number;
    rejectedCount: number;
    rejectedByContext: number;
    rejectedByDate: number;
    rejectedByAmount: number;
    rejectedByPeriod: number;
  };
  aiUsed: boolean;
  aiModel?: string;
  extractedAt: string;
}
