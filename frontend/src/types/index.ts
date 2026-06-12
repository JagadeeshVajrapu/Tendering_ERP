export type UserRole = 'executive' | 'md' | 'finance' | 'manager' | 'admin';

export type TenderStatus =
  | 'DRAFT'
  | 'NIT_ANALYZED'
  | 'SUMMARY_GENERATED'
  | 'PENDING_MD_APPROVAL'
  | 'APPROVED_BY_MD'
  | 'REJECTED_BY_MD'
  | 'FINANCE_PENDING'
  | 'FINANCE_APPROVED'
  | 'FINANCE_REJECTED'
  | 'MANAGER_PENDING'
  | 'MANAGER_APPROVED'
  | 'READY_FOR_BID'
  | 'SUBMITTED'
  | 'AWARDED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

export interface Tender {
  _id: string;
  title: string;
  tenderNumber?: string;
  authority?: string;
  estimatedValue?: number;
  status: TenderStatus;
  currentStage: string;
  createdBy?: { name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedNitData {
  tenderAuthority?: string;
  tenderNumber?: string;
  tenderValue?: number;
  emdAmount?: number;
  bgRequirement?: string;
  completionTime?: string;
  eligibilityCriteria?: string[];
  technicalRequirements?: string[];
  submissionDate?: string;
  bidOpeningDate?: string;
  reverseAuction?: boolean;
  scopeOfWork?: string;
  experienceRequirement?: string;
  turnoverRequirement?: string;
  requiredDocuments?: string[];
  importantDates?: { label: string; date: string }[];
}

export interface NitAnalysis {
  _id: string;
  extractedData: ExtractedNitData;
  riskAssessment: {
    riskSummary: string;
    disqualificationPoints: string[];
    missingDocuments: string[];
    criticalClauses: string[];
    deadlineRisks: string[];
    financialRisks: string[];
    riskLevel: 'High' | 'Medium' | 'Low';
  };
  eligibilityScore: number;
}

export interface EligibilityResult {
  status: 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE';
  score: number;
  ruleChecks: { rule: string; passed: boolean; message: string }[];
  summary: string;
  recommendations: string[];
}

export interface TenderSummary {
  _id: string;
  tenderName: string;
  tenderAuthority: string;
  scope: string;
  eligibility: string;
  estimatedRevenue: number;
  emdRequirement: string;
  completionTimeline: string;
  riskSummary: string;
  recommendation: 'Proceed' | 'Do Not Proceed';
  recommendationReason: string;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

export interface TenderAnalysis {
  _id: string;
  tenderId: string;
  tenderName: string;
  department: string;
  organization: string;
  tenderNumber: string;
  estimatedValue: string;
  emdAmount: string;
  bgRequirement?: string;
  bidSubmissionDate: string;
  preBidMeetingDate: string;
  contractDuration: string;
  scopeOfWork: string;
  eligibilityCriteria: string[];
  technicalRequirements?: string[];
  reverseAuction?: string;
  mafRequired?: string;
  requiredDocuments: string[];
  importantDates: { label: string; date: string }[];
  paymentTerms: string;
  riskFactors: string[];
  aiRecommendation: string;
  processingTimeMs?: number;
  createdAt?: string;
}

export interface MergedField {
  value: string | string[] | null;
  sourcePages: number[];
  confidence: number;
  validated?: boolean;
  allExtractions?: { value: string | string[] | null; page: number; confidence: number }[];
}

export type IntelligencePhase = 'processing' | 'complete';

export type IntelligenceRecommendation = 'Apply' | 'Apply with Caution' | 'Do Not Apply';

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
  recommendation?: IntelligenceRecommendation;
}

export interface ExecutiveNitPresentation {
  rows: NitSheetRow[];
  sections: NitSheetSection[];
  recommendation: IntelligenceRecommendation;
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
  executiveSheet?: ExecutiveNitPresentation;
}

export interface MdReport {
  scopeSummary: string;
  eligibilitySummary: string;
  financialSummary: string;
  timelineSummary: string;
  riskAssessment: string;
  recommendation: IntelligenceRecommendation;
}

export interface VerifiedNitJson {
  tenderNumber?: string;
  tenderName?: string;
  tenderAuthority?: string;
  estimatedTenderValue?: string;
  emdAmount?: string;
  submissionMode?: string;
  bidSystem?: string;
  contractDuration?: string;
  workLocation?: string;
  turnoverRequirement?: string;
  experienceRequirement?: string;
  gstRequirement?: string;
  epfRequirement?: string;
  esiRequirement?: string;
  [key: string]: string | string[] | undefined;
}

export interface TenderIntelligence {
  _id: string;
  tenderId: string;
  pageCount: number;
  chunkCount: number;
  phase: IntelligencePhase;
  merged: Record<string, MergedField>;
  verifiedNit?: VerifiedNitJson;
  nitTables?: NitAnalysisSheet;
  executiveBullets?: string[];
  mdReport?: MdReport;
  scopeSummary: string;
  eligibilitySummary: string;
  timelineSummary: string;
  financialSummary: string;
  riskSummary: string;
  recommendation: IntelligenceRecommendation;
  processingTimeMs: number;
  createdAt: string;
}

export interface IntelligenceJob {
  _id: string;
  documentId?: string;
  status: string;
  progress: number;
  pageCount: number;
  chunkCount: number;
  chunksProcessed: number;
  passesCompleted: number;
  totalChunkPasses: number;
  errorMessage?: string;
}

export type TenderExtractionStatus =
  | 'uploaded'
  | 'processing'
  | 'text_extracted'
  | 'rule_analysis_complete'
  | 'ai_verification_complete'
  | 'failed';

export interface TenderExtractedField {
  fieldName: string;
  value: string;
  normalizedValue?: string;
  confidence: number;
  matchType: 'exact' | 'regex' | 'alias' | 'fuzzy';
  evidence?: string;
}

export interface TenderExtraction {
  _id: string;
  tenderId: string;
  documentId: string;
  status: TenderExtractionStatus;
  progress: number;
  errorMessage?: string;
  detectedFileType?: 'digital_pdf' | 'scanned_pdf' | 'docx' | 'image' | 'unknown';
  extractedFields: TenderExtractedField[];
  createdAt: string;
}

export interface TimelineEntry {
  milestone: string;
  date: string;
}

export interface ExecutiveReportSnapshot {
  overviewLines: string[];
  scopeBullets: string[];
  eligibilityBullets: string[];
  eligibilityStatus: string;
  timelineRows: TimelineEntry[];
  recommendation: string;
  recommendationJustification: string;
}

export interface FeasibilityReport {
  _id: string;
  tenderId: string;
  scopeSummary: string;
  eligibilitySummary: string;
  timelineSummary: string;
  financialSummary: string;
  keyRisks: string[];
  recommendation: 'Suitable' | 'Not Suitable';
  intelligenceRecommendation?: string;
  recommendationJustification?: string;
  eligibilityStatus?: string;
  executiveReport?: ExecutiveReportSnapshot;
  pdfPath: string;
  pdfFileName: string;
  createdAt?: string;
}

export interface MdDecision {
  decision: 'APPROVED' | 'REJECTED';
  remarks: string;
  approvedBy: string;
  approvedAt: string;
}

export interface PopulatedUser {
  _id: string;
  name: string;
  email?: string;
  department?: string;
}

export interface PopulatedTender {
  _id: string;
  title: string;
  tenderNumber?: string;
  authority?: string;
  estimatedValue?: number;
  status?: TenderStatus;
  createdBy?: PopulatedUser;
}

export interface FinanceRequestRecord {
  _id: string;
  requestType: string;
  amount: number;
  status: string;
  utrNumber?: string;
  transactionId?: string;
  bankDetails?: string;
  comments?: string;
  paidAt?: string;
  decidedAt?: string;
  createdAt: string;
  tenderId?: PopulatedTender;
  requestedBy?: PopulatedUser;
  approvedBy?: PopulatedUser;
  rejectedBy?: PopulatedUser;
  paymentProofUrl?: string;
}

export interface ComplianceDocument {
  _id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  s3Url?: string;
  localPath?: string;
  createdAt: string;
}

export interface ComplianceRequestRecord {
  _id: string;
  documentTypes: string[];
  status: string;
  comments?: string;
  decidedAt?: string;
  createdAt: string;
  tenderId?: PopulatedTender;
  requestedBy?: PopulatedUser;
  approvedBy?: PopulatedUser;
  documentIds?: ComplianceDocument[];
}

export interface MdApprovalRecord {
  _id: string;
  decision: string;
  comments?: string;
  decidedAt?: string;
  createdAt: string;
  tenderId?: PopulatedTender;
  requestedBy?: PopulatedUser;
  reviewedBy?: PopulatedUser;
  feasibilityReport?: FeasibilityReport | null;
}
