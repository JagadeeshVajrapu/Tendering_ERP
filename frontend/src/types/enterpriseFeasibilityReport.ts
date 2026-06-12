export type EnterpriseFeasibilityRecommendation =
  | 'Strongly Recommended'
  | 'Recommended'
  | 'Recommended With Conditions'
  | 'High Risk'
  | 'Not Recommended';

export type MdFeasibilityAction =
  | 'approve'
  | 'reject'
  | 'request_clarification'
  | 'request_missing_documents'
  | 'request_finance_approval'
  | 'request_compliance_review'
  | 'participate_with_conditions';

export interface EnterpriseFeasibilityReport {
  tenderId: string;
  documentId: string;
  generatedAt: string;
  approvalStatus: string;
  decisionHistory: Array<{
    action: string;
    by: string;
    byRole: string;
    at: string;
    comments?: string;
  }>;
  overview: {
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
  };
  scopeSummary: { bullets: string[] };
  manpowerRequirements: {
    items: Array<{ role: string; count: string }>;
    totalEstimated: string;
  };
  eligibilitySummary: {
    turnoverRequirement: string;
    experienceRequirement: string;
    netWorthRequirement: string;
    bidCapacity: string;
    bankSolvency: string;
    mandatoryCertifications: string[];
  };
  financialSummary: {
    tenderValue: string;
    emd: string;
    tenderFee: string;
    performanceSecurity: string;
    bankGuarantee: string;
    estimatedFinancialExposure: string;
  };
  timelineSummary: {
    publishingDate: string;
    preBidMeeting: string;
    bidStartDate: string;
    bidEndDate: string;
    technicalOpening: string;
    financialOpening: string;
    completionPeriod: string;
    daysRemaining: number | null;
  };
  checklistReadiness: {
    requiredDocuments: number;
    uploadedDocuments: number;
    missingDocuments: number;
    expiredDocuments: number;
    readinessScore: number;
    readinessLabel: string;
    criticalMissing: string[];
  };
  experienceMatching: {
    matchingProjects: string[];
    experienceGaps: string[];
    eligibilityStatus: string;
    rows: Array<{ requirement: string; status: string; note: string }>;
  };
  riskAnalysis: {
    overallLevel: string;
    risks: Array<{ riskType: string; level: string; reason: string }>;
  };
  aiRecommendation: {
    recommendation: EnterpriseFeasibilityRecommendation;
    reason: string;
    benefits: string[];
    risks: string[];
    requiredActions: string[];
  };
  financeWorkflow?: {
    emdStatus: string;
    bgStatus: string;
    tenderFeeStatus: string;
  };
  complianceWorkflow?: {
    packageGenerated: boolean;
    approvalStatus: string;
    missingDocuments: string[];
  };
}
