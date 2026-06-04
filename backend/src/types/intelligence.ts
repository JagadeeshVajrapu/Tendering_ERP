/** A single extracted value with provenance — never discard source metadata. */
export interface ExtractedField {
  value: string | string[] | null;
  page: number;
  confidence: number;
  sourceText?: string;
}

export type IntelligenceFieldKey =
  | 'tenderName'
  | 'organization'
  | 'department'
  | 'issuingAuthority'
  | 'tenderNumber'
  | 'tenderReferenceNumber'
  | 'tenderType'
  | 'tenderCategory'
  | 'estimatedTenderValue'
  | 'emdAmount'
  | 'emdExemption'
  | 'bidSecurityAmount'
  | 'tenderFee'
  | 'bidSubmissionDate'
  | 'bidSubmissionStartDate'
  | 'bidOpeningDate'
  | 'technicalBidOpeningDate'
  | 'financialBidOpeningDate'
  | 'preBidMeetingDate'
  | 'tenderPublishDate'
  | 'contractDuration'
  | 'workLocation'
  | 'serviceCategory'
  | 'scopeOfWork'
  | 'eligibilityCriteria'
  | 'requiredDocuments'
  | 'technicalRequirements'
  | 'technicalConditions'
  | 'financialRequirements'
  | 'financialConditions'
  | 'paymentTerms'
  | 'experienceRequirements'
  | 'turnoverRequirements'
  | 'manpowerRequirements'
  | 'licensesRequired'
  | 'registrationsRequired'
  | 'certificationsRequired'
  | 'statutoryRequirements'
  | 'complianceRequirements'
  | 'importantDates'
  | 'penalties'
  | 'penaltyClauses'
  | 'liquidatedDamages'
  | 'performanceSecurity'
  | 'bankGuarantee'
  | 'risks'
  | 'contactDetails'
  | 'submissionMode';

export type ExtractionPass =
  | 'rule'
  | 'general'
  | 'scope'
  | 'eligibility'
  | 'financial'
  | 'documents'
  | 'dates'
  | 'compliance'
  | 'risks'
  | 'executive';

/** Structured NIT Analysis Sheet — executive dashboard (never raw AI text). */
export interface NitTableRow {
  parameter: string;
  value: string;
  sourcePage: string;
  confidence: number;
  needsReview?: boolean;
}

export interface NitEligibilityRow {
  parameter: string;
  requirement: string;
  sourcePage: string;
  confidence: number;
  needsReview?: boolean;
}

export interface NitDocumentRow {
  document: string;
  sourcePage: string;
  confidence: number;
}

export interface NitRiskRow {
  risk: string;
  severity: 'Low' | 'Medium' | 'High';
  description?: string;
  sourcePage?: string;
  confidence?: number;
}

export interface NitSheetRow {
  parameter: string;
  value: string;
}

export interface NitRiskItem {
  category: string;
  level: 'Low' | 'Medium' | 'High';
  note: string;
  explanation?: string;
  confidence?: number;
}

export interface NitSheetSection {
  id: string;
  title: string;
  rows: NitSheetRow[];
  variant?: 'table' | 'scope' | 'documents' | 'technical' | 'risk' | 'recommendation';
  scopeLines?: string[];
  documentItems?: string[];
  technicalItems?: string[];
  riskItems?: NitRiskItem[];
  riskLevel?: 'Low' | 'Medium' | 'High';
  riskReason?: string;
  recommendation?: FeasibilityRecommendation;
}

export interface ExecutiveNitPresentation {
  /** Flat consultant NIT table (primary dashboard output). */
  rows: NitSheetRow[];
  sections: NitSheetSection[];
  recommendation: FeasibilityRecommendation;
  verifiedFieldCount: number;
}

export interface NitAnalysisSheet {
  generalInformation: NitTableRow[];
  financialInformation: NitTableRow[];
  timelineInformation: NitTableRow[];
  eligibilityInformation: NitEligibilityRow[];
  requiredDocuments: NitDocumentRow[];
  technicalRequirements?: NitTableRow[];
  complianceRequirements: NitTableRow[];
  riskAnalysis: NitRiskRow[];
  executiveSummary: string[];
  /** Executive 2-column NIT sheet (Parameter | Value). */
  executiveSheet?: ExecutiveNitPresentation;
}

export interface MdReport {
  scopeSummary: string;
  eligibilitySummary: string;
  financialSummary: string;
  timelineSummary: string;
  riskAssessment: string;
  recommendation: FeasibilityRecommendation;
  criticalRequirements?: string[];
}

export type IntelligenceJobStatus =
  | 'queued'
  | 'extracting_pages'
  | 'chunking'
  | 'analyzing'
  | 'merging'
  | 'validating'
  | 'generating_report'
  | 'completed'
  | 'failed';

export type IntelligencePhase = 'processing' | 'complete';

export type FeasibilityRecommendation = 'Apply' | 'Apply with Caution' | 'Do Not Apply';

export interface MergedField {
  value: string | string[] | null;
  sourcePages: number[];
  confidence: number;
  validated?: boolean;
  allExtractions: ExtractedField[];
}

export type MergedIntelligence = Record<IntelligenceFieldKey, MergedField>;

export interface PageText {
  pageNumber: number;
  text: string;
  method: 'native' | 'ocr' | 'docx' | 'pdf-parse' | 'textract' | 'mammoth';
  charCount: number;
}

export interface DocumentChunkData {
  chunkNumber: number;
  startPage: number;
  endPage: number;
  text: string;
  pageNumbers: number[];
}

export interface ChunkExtractionResult {
  chunkNumber: number;
  pass: ExtractionPass;
  fields: Partial<Record<IntelligenceFieldKey, ExtractedField[]>>;
  rawJson: string;
  model: string;
  tokensUsed?: number;
}
