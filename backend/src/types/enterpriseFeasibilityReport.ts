export type EnterpriseFeasibilityRecommendation =
  | 'Strongly Recommended'
  | 'Recommended'
  | 'Recommended With Conditions'
  | 'High Risk'
  | 'Not Recommended';

export type FeasibilityApprovalStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'review'
  | 'conditional';

export type MdFeasibilityAction =
  | 'approve'
  | 'reject'
  | 'request_clarification'
  | 'request_missing_documents'
  | 'request_finance_approval'
  | 'request_compliance_review'
  | 'participate_with_conditions';

export interface FeasibilityDecisionEntry {
  action: MdFeasibilityAction | string;
  by: string;
  byRole: string;
  at: string;
  comments?: string;
}

export interface TenderOverviewSection {
  tenderNumber: string;
  organization: string;
  tenderTitle: string;
  serviceCategory: string;
  location: string;
  tenderValue: string;
  emdAmount: string;
  tenderFee: string;
  completionPeriod: string;
  contractPeriod: string;
  bidSubmissionEndDate: string;
}

export interface ScopeSummarySection {
  bullets: string[];
}

export interface ManpowerRequirementRow {
  role: string;
  count: string;
  source: string;
}

export interface ManpowerRequirementsSection {
  items: ManpowerRequirementRow[];
  totalEstimated: string;
}

export interface EligibilitySummarySection {
  turnoverRequirement: string;
  experienceRequirement: string;
  netWorthRequirement: string;
  bidCapacity: string;
  bankSolvency: string;
  mandatoryCertifications: string[];
}

export interface FinancialSummarySection {
  tenderValue: string;
  emd: string;
  tenderFee: string;
  performanceSecurity: string;
  bankGuarantee: string;
  estimatedFinancialExposure: string;
}

export interface TimelineSummarySection {
  publishingDate: string;
  preBidMeeting: string;
  bidStartDate: string;
  bidEndDate: string;
  technicalOpening: string;
  financialOpening: string;
  completionPeriod: string;
  daysRemaining: number | null;
}

export interface ChecklistReadinessSection {
  requiredDocuments: number;
  uploadedDocuments: number;
  missingDocuments: number;
  expiredDocuments: number;
  readinessScore: number;
  readinessLabel: string;
  criticalMissing: string[];
}

export interface ExperienceMatchRow {
  requirement: string;
  status: 'matched' | 'partial' | 'gap';
  note: string;
}

export interface ExperienceMatchingSection {
  matchingProjects: string[];
  experienceGaps: string[];
  eligibilityStatus: 'Likely Eligible' | 'Partially Eligible' | 'Not Eligible';
  rows: ExperienceMatchRow[];
}

export interface RiskAnalysisRow {
  riskType: string;
  level: 'Low' | 'Medium' | 'High';
  reason: string;
  confidence: number;
}

export interface RiskAnalysisSection {
  overallLevel: 'Low' | 'Medium' | 'High';
  risks: RiskAnalysisRow[];
}

export interface AiRecommendationSection {
  recommendation: EnterpriseFeasibilityRecommendation;
  reason: string;
  benefits: string[];
  risks: string[];
  requiredActions: string[];
}

export interface FinanceWorkflowStatus {
  emdStatus: string;
  bgStatus: string;
  tenderFeeStatus: string;
}

export interface ComplianceWorkflowStatus {
  packageGenerated: boolean;
  approvalStatus: string;
  missingDocuments: string[];
}

export interface EnterpriseFeasibilityReport {
  tenderId: string;
  documentId: string;
  schemaVersion: number;
  dataSource: 'enterprise_master_dataset';
  generatedAt: string;
  generatedBy?: string;
  approvalStatus: FeasibilityApprovalStatus;
  decisionHistory: FeasibilityDecisionEntry[];
  overview: TenderOverviewSection;
  scopeSummary: ScopeSummarySection;
  manpowerRequirements: ManpowerRequirementsSection;
  eligibilitySummary: EligibilitySummarySection;
  financialSummary: FinancialSummarySection;
  timelineSummary: TimelineSummarySection;
  checklistReadiness: ChecklistReadinessSection;
  experienceMatching: ExperienceMatchingSection;
  riskAnalysis: RiskAnalysisSection;
  aiRecommendation: AiRecommendationSection;
  financeWorkflow?: FinanceWorkflowStatus;
  complianceWorkflow?: ComplianceWorkflowStatus;
}
