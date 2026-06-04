import { MasterDatasetKey } from '../../types/masterDataset';

export interface NitAnalysisSectionDefinition {
  id: string;
  title: string;
  description: string;
  fields: MasterDatasetKey[];
}

/** NIT Analysis section layout — every master dataset field appears exactly once. */
export const NIT_ANALYSIS_SECTIONS: NitAnalysisSectionDefinition[] = [
  {
    id: 'tender-overview',
    title: 'Tender Overview',
    description: 'Identity, issuing authority, work details, location, and contact information.',
    fields: [
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
      'contactName',
      'contactDesignation',
      'contactEmail',
      'contactPhone',
      'scopeOfWork',
    ],
  },
  {
    id: 'financial-analysis',
    title: 'Financial Analysis',
    description: 'Estimated value, fees, payment terms, and penalty provisions.',
    fields: [
      'estimatedCost',
      'tenderValue',
      'emdAmount',
      'documentFee',
      'paymentTerms',
      'penaltyClauses',
    ],
  },
  {
    id: 'eligibility-analysis',
    title: 'Eligibility Analysis',
    description: 'Bidder qualification criteria and resource requirements.',
    fields: [
      'eligibilityCriteria',
      'experienceRequirement',
      'turnoverRequirement',
      'manpowerRequirement',
      'equipmentRequirement',
    ],
  },
  {
    id: 'timeline-analysis',
    title: 'Timeline Analysis',
    description: 'Publication, submission, opening dates, and contract duration.',
    fields: [
      'publishingDate',
      'bidStartDate',
      'bidEndDate',
      'technicalBidDate',
      'financialBidDate',
      'preBidMeetingDate',
      'completionPeriod',
      'contractPeriod',
    ],
  },
  {
    id: 'compliance-analysis',
    title: 'Compliance Analysis',
    description: 'Mandatory certificates, documents, and performance security.',
    fields: ['certificates', 'performanceSecurity'],
  },
];

export const NIT_FIELD_LABELS: Record<MasterDatasetKey, string> = {
  tenderNumber: 'Tender Number',
  nitNumber: 'NIT Number',
  bidReferenceNumber: 'Bid Reference Number',
  department: 'Department',
  organization: 'Organization / Issuing Authority',
  tenderTitle: 'Tender Name',
  workName: 'Name of Work',
  location: 'Work Location',
  district: 'District',
  state: 'State',
  country: 'Country',
  estimatedCost: 'Estimated Cost',
  tenderValue: 'Tender Value',
  emdAmount: 'EMD Amount',
  documentFee: 'Tender / Document Fee',
  publishingDate: 'Publishing Date',
  bidStartDate: 'Bid Start Date',
  bidEndDate: 'Bid End Date / Last Date of Submission',
  technicalBidDate: 'Technical Bid Opening Date',
  financialBidDate: 'Financial Bid Opening Date',
  preBidMeetingDate: 'Pre-Bid Meeting Date',
  contactName: 'Contact Person',
  contactDesignation: 'Contact Designation',
  contactEmail: 'Contact Email',
  contactPhone: 'Contact Phone',
  eligibilityCriteria: 'Eligibility Criteria',
  experienceRequirement: 'Experience Requirement',
  turnoverRequirement: 'Turnover Requirement',
  manpowerRequirement: 'Manpower Requirement',
  equipmentRequirement: 'Equipment Requirement',
  completionPeriod: 'Completion Period',
  contractPeriod: 'Contract Period',
  performanceSecurity: 'Performance Security / Bank Guarantee',
  paymentTerms: 'Payment Terms',
  penaltyClauses: 'Penalty / Liquidated Damages',
  certificates: 'Required Certificates / Documents',
  scopeOfWork: 'Scope of Work',
};
