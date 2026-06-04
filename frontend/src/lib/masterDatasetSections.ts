import type { MasterDatasetKey } from '@/types/masterDataset';

export interface MasterDatasetSection {
  id: string;
  title: string;
  description: string;
  fields: MasterDatasetKey[];
}

export const MASTER_DATASET_SECTIONS: MasterDatasetSection[] = [
  {
    id: 'document-summary',
    title: 'Document Summary',
    description: 'Identity, authority, and location details from the NIT document.',
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
    ],
  },
  {
    id: 'financial',
    title: 'Financial Information',
    description: 'Estimated value, fees, security, and commercial terms.',
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
    id: 'eligibility',
    title: 'Eligibility Requirements',
    description: 'Qualification criteria for bidder participation.',
    fields: [
      'eligibilityCriteria',
      'experienceRequirement',
      'turnoverRequirement',
      'manpowerRequirement',
      'equipmentRequirement',
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline Information',
    description: 'Key dates and contract duration milestones.',
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
    id: 'contact',
    title: 'Contact Information',
    description: 'Issuing authority contact details for queries.',
    fields: ['contactName', 'contactDesignation', 'contactEmail', 'contactPhone'],
  },
  {
    id: 'compliance',
    title: 'Compliance Requirements',
    description: 'Mandatory certificates, guarantees, and security obligations.',
    fields: ['certificates', 'performanceSecurity'],
  },
  {
    id: 'scope',
    title: 'Scope of Work',
    description: 'Detailed work description and deliverables.',
    fields: ['scopeOfWork'],
  },
];

export const MASTER_FIELD_LABELS: Record<MasterDatasetKey, string> = {
  tenderNumber: 'Tender Number',
  nitNumber: 'NIT Number',
  bidReferenceNumber: 'Bid Reference Number',
  department: 'Department',
  organization: 'Organization',
  tenderTitle: 'Tender Title',
  workName: 'Work Name',
  location: 'Location',
  district: 'District',
  state: 'State',
  country: 'Country',
  estimatedCost: 'Estimated Cost',
  tenderValue: 'Tender Value',
  emdAmount: 'EMD Amount',
  documentFee: 'Document Fee',
  publishingDate: 'Publishing Date',
  bidStartDate: 'Bid Start Date',
  bidEndDate: 'Bid End Date',
  technicalBidDate: 'Technical Bid Date',
  financialBidDate: 'Financial Bid Date',
  preBidMeetingDate: 'Pre-Bid Meeting Date',
  contactName: 'Contact Name',
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
  performanceSecurity: 'Performance Security',
  paymentTerms: 'Payment Terms',
  penaltyClauses: 'Penalty Clauses',
  certificates: 'Certificates / Required Documents',
  scopeOfWork: 'Scope of Work',
};

export const LOW_CONFIDENCE_THRESHOLD = 80;

export function formatExtractionMethod(method: string): string {
  const map: Record<string, string> = {
    exact: 'Exact Match',
    alias: 'Alias Match',
    regex: 'Regex Pattern',
    fuzzy: 'Fuzzy Match',
    confidence_merge: 'Confidence Merge',
  };
  return map[method] || method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
