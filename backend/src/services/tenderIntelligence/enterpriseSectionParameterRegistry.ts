import { MasterDatasetKey } from '../../types/masterDataset';
import { TenderDocumentSectionType } from '../../types/tenderIntelligenceLayer';

export interface ParameterSectionRule {
  primarySection: TenderDocumentSectionType;
  fallbackSections: TenderDocumentSectionType[];
  labelPatterns: RegExp[];
  canonicalKeys?: MasterDatasetKey[];
}

export const PARAMETER_SECTION_RULES: ParameterSectionRule[] = [
  {
    primarySection: 'Identity',
    fallbackSections: ['Financial', 'Timeline'],
    canonicalKeys: [
      'tenderNumber',
      'nitNumber',
      'bidReferenceNumber',
      'organization',
      'department',
      'tenderTitle',
      'workName',
      'location',
      'district',
      'state',
      'country',
    ],
    labelPatterns: [
      /tender\s+(?:no|number)/i,
      /\bnit\b/i,
      /organization|organisation/i,
      /department/i,
      /name\s+of\s+work/i,
      /tender\s+title/i,
      /location/i,
    ],
  },
  {
    primarySection: 'Financial',
    fallbackSections: ['Identity', 'Timeline', 'Tender Specific'],
    canonicalKeys: [
      'tenderValue',
      'estimatedCost',
      'emdAmount',
      'documentFee',
      'performanceSecurity',
      'bankGuarantee',
      'paymentTerms',
    ],
    labelPatterns: [
      /tender\s+value/i,
      /estimated\s+cost/i,
      /emd|earnest\s+money/i,
      /tender\s+fee|document\s+fee/i,
      /performance\s+(?:security|guarantee)/i,
      /bank\s+guarantee/i,
      /payment\s+terms/i,
      /security\s+deposit/i,
    ],
  },
  {
    primarySection: 'Timeline',
    fallbackSections: ['Financial', 'Identity'],
    canonicalKeys: [
      'publishingDate',
      'bidStartDate',
      'bidEndDate',
      'technicalBidDate',
      'financialBidDate',
      'preBidMeetingDate',
      'completionPeriod',
      'contractPeriod',
    ],
    labelPatterns: [
      /publishing\s+date/i,
      /pre[\s-]?bid/i,
      /bid\s+(?:start|end|opening|closing)/i,
      /last\s+date/i,
      /submission\s+deadline/i,
      /technical\s+(?:opening|bid)/i,
      /financial\s+(?:opening|bid)/i,
      /completion\s+period/i,
      /contract\s+period/i,
    ],
  },
  {
    primarySection: 'Eligibility',
    fallbackSections: ['Experience', 'Compliance'],
    canonicalKeys: [
      'eligibilityCriteria',
      'turnoverRequirement',
      'experienceRequirement',
      'netWorthRequirement',
      'bidCapacity',
      'manpowerRequirement',
    ],
    labelPatterns: [
      /eligibility/i,
      /qualification/i,
      /turnover/i,
      /experience\s+requirement/i,
      /net\s+worth/i,
      /bid\s+capacity/i,
      /manpower/i,
    ],
  },
  {
    primarySection: 'Compliance',
    fallbackSections: ['Eligibility', 'Experience'],
    canonicalKeys: [
      'gst',
      'pan',
      'msme',
      'pf',
      'esic',
      'iso',
      'labourLicense',
      'bankSolvency',
      'certificates',
    ],
    labelPatterns: [
      /\bgst\b/i,
      /\bpan\b/i,
      /\bmsme\b/i,
      /\bepf\b|\bpf\b/i,
      /\besic\b|\b esi\b/i,
      /labour\s+licen/i,
      /\biso\b/i,
      /bank\s+solvency/i,
      /declaration/i,
    ],
  },
  {
    primarySection: 'Experience',
    fallbackSections: ['Eligibility'],
    canonicalKeys: ['workOrders', 'completionCertificates', 'experienceCertificates'],
    labelPatterns: [
      /work\s+order/i,
      /completion\s+certificate/i,
      /experience\s+certificate/i,
      /past\s+project/i,
      /client\s+reference/i,
      /similar\s+work/i,
    ],
  },
  {
    primarySection: 'Scope',
    fallbackSections: ['Technical Specifications', 'Tender Specific'],
    canonicalKeys: ['scopeOfWork', 'manpowerRequirement', 'equipmentRequirement'],
    labelPatterns: [
      /scope\s+of\s+work/i,
      /deliverables/i,
      /deployment/i,
      /activities/i,
      /responsibilities/i,
      /services?\s+to\s+be/i,
    ],
  },
  {
    primarySection: 'Technical Specifications',
    fallbackSections: ['Scope'],
    canonicalKeys: ['technicalRequirements', 'equipmentRequirement'],
    labelPatterns: [
      /technical\s+(?:specification|requirement)/i,
      /equipment/i,
      /machinery/i,
      /software/i,
      /hardware/i,
      /network/i,
      /performance\s+standard/i,
    ],
  },
  {
    primarySection: 'Tender Specific',
    fallbackSections: ['Scope', 'Financial', 'Compliance'],
    canonicalKeys: ['bgRequired', 'mafRequired', 'reverseAuction'],
    labelPatterns: [
      /\bmaf\b/i,
      /oem\s+author/i,
      /reverse\s+auction/i,
      /make\s+in\s+india/i,
      /mse\s+preference/i,
      /\bgem\b/i,
      /psara/i,
      /epbg|ebg/i,
    ],
  },
];

export function resolveParameterSectionRule(
  parameter: string,
  canonicalKey?: string
): ParameterSectionRule | null {
  const key = canonicalKey as MasterDatasetKey | undefined;
  if (key) {
    const byKey = PARAMETER_SECTION_RULES.find((r) => r.canonicalKeys?.includes(key));
    if (byKey) return byKey;
  }

  const label = String(parameter || '').trim();
  for (const rule of PARAMETER_SECTION_RULES) {
    if (rule.labelPatterns.some((p) => p.test(label))) return rule;
  }
  return null;
}

export function getPrimarySectionForParameter(
  parameter: string,
  canonicalKey?: string
): TenderDocumentSectionType | null {
  return resolveParameterSectionRule(parameter, canonicalKey)?.primarySection ?? null;
}

export function getAllowedSectionsForParameter(
  parameter: string,
  canonicalKey?: string
): TenderDocumentSectionType[] {
  const rule = resolveParameterSectionRule(parameter, canonicalKey);
  if (!rule) return [];
  return [rule.primarySection, ...rule.fallbackSections];
}
