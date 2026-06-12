import { MasterDatasetKey } from '../../types/masterDataset';
import { getDictionaryCanonicalLabel } from '../tenderParameter/masterTenderParameterDictionaryEngine';
import { NIT_ALLOWED_DATASET_KEYS } from '../tenderParameter/masterTenderParameterDictionary';

export interface NitAnalysisSectionDefinition {
  id: string;
  title: string;
  description: string;
  fields: MasterDatasetKey[];
}

/** NIT Analysis sections — only Master Tender Parameter Dictionary fields. */
export const NIT_ANALYSIS_SECTIONS: NitAnalysisSectionDefinition[] = [
  {
    id: 'identity',
    title: 'Identity',
    description: 'Tender identity, authority, work details, and location.',
    fields: [
      'tenderNumber',
      'nitNumber',
      'organization',
      'department',
      'tenderTitle',
      'workName',
      'location',
    ],
  },
  {
    id: 'financial',
    title: 'Financial',
    description: 'Tender value, EMD, fees, and security requirements.',
    fields: ['tenderValue', 'emdAmount', 'documentFee', 'performanceSecurity', 'bankGuarantee'],
  },
  {
    id: 'timeline',
    title: 'Timeline',
    description: 'Publication, submission, opening dates, and contract duration.',
    fields: [
      'publishingDate',
      'bidStartDate',
      'bidEndDate',
      'technicalBidDate',
      'financialBidDate',
      'completionPeriod',
      'contractPeriod',
    ],
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    description: 'Bidder qualification and capacity requirements.',
    fields: ['turnoverRequirement', 'experienceRequirement', 'netWorthRequirement', 'bidCapacity'],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    description: 'Mandatory statutory and registration requirements.',
    fields: ['gst', 'pan', 'msme', 'pf', 'esic', 'iso', 'labourLicense', 'bankSolvency'],
  },
  {
    id: 'experience',
    title: 'Experience',
    description: 'Past work evidence and certificates.',
    fields: ['workOrders', 'completionCertificates', 'experienceCertificates'],
  },
  {
    id: 'scope',
    title: 'Scope',
    description: 'Work scope and technical requirements.',
    fields: ['scopeOfWork', 'technicalRequirements'],
  },
];

export const NIT_FIELD_LABELS: Record<MasterDatasetKey, string> = Object.fromEntries(
  NIT_ALLOWED_DATASET_KEYS.map((key) => [key, getDictionaryCanonicalLabel(key)])
) as Record<MasterDatasetKey, string>;

// Legacy master dataset keys not in NIT dictionary — keep labels for internal use
const LEGACY_NIT_LABELS: Partial<Record<MasterDatasetKey, string>> = {
  bidReferenceNumber: 'Bid Reference Number',
  district: 'District',
  state: 'State',
  country: 'Country',
  estimatedCost: 'Estimated Cost',
  preBidMeetingDate: 'Pre-Bid Meeting Date',
  contactName: 'Contact Person',
  contactDesignation: 'Contact Designation',
  contactEmail: 'Contact Email',
  contactPhone: 'Contact Phone',
  eligibilityCriteria: 'Eligibility Criteria',
  manpowerRequirement: 'Manpower Requirement',
  equipmentRequirement: 'Equipment Requirement',
  paymentTerms: 'Payment Terms',
  penaltyClauses: 'Penalty / Liquidated Damages',
  certificates: 'Required Certificates / Documents',
};

for (const [key, label] of Object.entries(LEGACY_NIT_LABELS)) {
  if (!NIT_FIELD_LABELS[key as MasterDatasetKey]) {
    NIT_FIELD_LABELS[key as MasterDatasetKey] = label!;
  }
}
