import {
  MasterParameterGroup,
  MasterTenderParameterDefinition,
} from '../../types/masterTenderParameterDictionary';
import { MasterDatasetKey } from '../../types/masterDataset';

/**
 * Authoritative Tender Master Dictionary.
 * Only parameters listed here may enter the master dataset / NIT analysis.
 */
export const MASTER_TENDER_PARAMETER_DICTIONARY: MasterTenderParameterDefinition[] = [
  // Identity
  { canonical: 'Tender Number', canonicalKey: 'tenderNumber', group: 'Identity' },
  { canonical: 'NIT Number', canonicalKey: 'nitNumber', group: 'Identity' },
  { canonical: 'Organization', canonicalKey: 'organization', group: 'Identity' },
  { canonical: 'Department', canonicalKey: 'department', group: 'Identity' },
  { canonical: 'Tender Title', canonicalKey: 'tenderTitle', group: 'Identity' },
  { canonical: 'Name Of Work', canonicalKey: 'workName', group: 'Identity' },
  { canonical: 'Location', canonicalKey: 'location', group: 'Identity' },

  // Financial
  { canonical: 'Tender Value', canonicalKey: 'tenderValue', group: 'Financial' },
  { canonical: 'Estimated Cost', canonicalKey: 'estimatedCost', group: 'Financial' },
  { canonical: 'EMD Amount', canonicalKey: 'emdAmount', group: 'Financial' },
  { canonical: 'Tender Fee', canonicalKey: 'documentFee', group: 'Financial' },
  { canonical: 'Performance Security', canonicalKey: 'performanceSecurity', group: 'Financial' },
  { canonical: 'Bank Guarantee', canonicalKey: 'bankGuarantee', group: 'Financial' },

  // Timeline
  { canonical: 'Publishing Date', canonicalKey: 'publishingDate', group: 'Timeline' },
  { canonical: 'Pre Bid Meeting Date', canonicalKey: 'preBidMeetingDate', group: 'Timeline' },
  { canonical: 'Bid Start Date', canonicalKey: 'bidStartDate', group: 'Timeline' },
  { canonical: 'Bid End Date', canonicalKey: 'bidEndDate', group: 'Timeline' },
  { canonical: 'Technical Bid Opening Date', canonicalKey: 'technicalBidDate', group: 'Timeline' },
  { canonical: 'Financial Bid Opening Date', canonicalKey: 'financialBidDate', group: 'Timeline' },
  { canonical: 'Completion Period', canonicalKey: 'completionPeriod', group: 'Timeline' },
  { canonical: 'Contract Period', canonicalKey: 'contractPeriod', group: 'Timeline' },

  // Eligibility
  { canonical: 'Turnover Requirement', canonicalKey: 'turnoverRequirement', group: 'Eligibility' },
  { canonical: 'Experience Requirement', canonicalKey: 'experienceRequirement', group: 'Eligibility' },
  { canonical: 'Net Worth Requirement', canonicalKey: 'netWorthRequirement', group: 'Eligibility' },
  { canonical: 'Bid Capacity', canonicalKey: 'bidCapacity', group: 'Eligibility' },

  // Compliance
  { canonical: 'GST Requirement', canonicalKey: 'gst', group: 'Compliance' },
  { canonical: 'PAN Requirement', canonicalKey: 'pan', group: 'Compliance' },
  { canonical: 'MSME Requirement', canonicalKey: 'msme', group: 'Compliance' },
  { canonical: 'ISO Requirement', canonicalKey: 'iso', group: 'Compliance' },
  { canonical: 'PF Requirement', canonicalKey: 'pf', group: 'Compliance' },
  { canonical: 'ESIC Requirement', canonicalKey: 'esic', group: 'Compliance' },
  { canonical: 'Labour License Requirement', canonicalKey: 'labourLicense', group: 'Compliance' },
  { canonical: 'Bank Solvency Requirement', canonicalKey: 'bankSolvency', group: 'Compliance' },

  // Experience
  { canonical: 'Work Order Requirement', canonicalKey: 'workOrders', group: 'Experience' },
  { canonical: 'Completion Certificate Requirement', canonicalKey: 'completionCertificates', group: 'Experience' },
  { canonical: 'Experience Certificate Requirement', canonicalKey: 'experienceCertificates', group: 'Experience' },

  // Scope
  { canonical: 'Scope Of Work', canonicalKey: 'scopeOfWork', group: 'Scope' },
  { canonical: 'Technical Requirements', canonicalKey: 'technicalRequirements', group: 'Scope' },

  // Tender Specific
  { canonical: 'BG Required', canonicalKey: 'bgRequired', group: 'Tender Specific' },
  { canonical: 'MAF Required', canonicalKey: 'mafRequired', group: 'Tender Specific' },
  { canonical: 'Reverse Auction', canonicalKey: 'reverseAuction', group: 'Tender Specific' },
];

export const NIT_ALLOWED_DATASET_KEYS: MasterDatasetKey[] = MASTER_TENDER_PARAMETER_DICTIONARY.map(
  (d) => d.canonicalKey
);

export const MASTER_DICTIONARY_PARAMETER_COUNT = MASTER_TENDER_PARAMETER_DICTIONARY.length;

export const NIT_PARAMETER_GROUP_ORDER: MasterParameterGroup[] = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Tender Specific',
];
