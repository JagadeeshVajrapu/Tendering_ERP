/**
 * Consultant NIT fields — processed one at a time (no bulk AI extraction).
 */
export const CONSULTANT_FIELD_IDS = [
  'tenderNumber',
  'issuingAuthority',
  'organization',
  'estimatedTenderValue',
  'emdAmount',
  'tenderFee',
  'contractDuration',
  'bidSubmissionDate',
  'submissionMode',
  'reverseAuction',
  'mafRequired',
  'turnoverRequirements',
  'experienceRequirements',
  'gstRequirement',
  'epfRequirement',
  'esiRequirement',
  'labourLicense',
  'requiredDocuments',
  'scopeOfWork',
  'technicalRequirements',
] as const;

export type ConsultantFieldId = (typeof CONSULTANT_FIELD_IDS)[number];

/** Display labels for executive table */
export const CONSULTANT_FIELD_LABELS: Record<string, string> = {
  tenderNumber: 'Tender Number',
  issuingAuthority: 'Tender Authority',
  organization: 'Tender Authority',
  estimatedTenderValue: 'Tender Value',
  emdAmount: 'EMD Amount',
  tenderFee: 'Tender Fee',
  contractDuration: 'Contract Duration',
  bidSubmissionDate: 'Submission End Date',
  submissionMode: 'Submission Mode',
  reverseAuction: 'Reverse Auction',
  mafRequired: 'MAF Required',
  turnoverRequirements: 'Turnover Requirement',
  experienceRequirements: 'Experience Requirement',
  gstRequirement: 'GST Requirement',
  epfRequirement: 'EPF Requirement',
  esiRequirement: 'ESI Requirement',
  labourLicense: 'Labour License Requirement',
  requiredDocuments: 'Required Documents',
  scopeOfWork: 'Scope of Work',
  technicalRequirements: 'Technical Requirements',
};
