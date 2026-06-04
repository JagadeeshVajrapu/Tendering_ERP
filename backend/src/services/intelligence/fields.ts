import { ExtractionPass, IntelligenceFieldKey } from '../../types/intelligence';

export const ALL_INTELLIGENCE_FIELDS: IntelligenceFieldKey[] = [
  'tenderName',
  'organization',
  'department',
  'issuingAuthority',
  'tenderNumber',
  'tenderReferenceNumber',
  'tenderType',
  'tenderCategory',
  'estimatedTenderValue',
  'emdAmount',
  'emdExemption',
  'bidSecurityAmount',
  'tenderFee',
  'bidSubmissionDate',
  'bidSubmissionStartDate',
  'bidOpeningDate',
  'technicalBidOpeningDate',
  'financialBidOpeningDate',
  'preBidMeetingDate',
  'tenderPublishDate',
  'contractDuration',
  'workLocation',
  'serviceCategory',
  'scopeOfWork',
  'eligibilityCriteria',
  'requiredDocuments',
  'technicalRequirements',
  'technicalConditions',
  'financialRequirements',
  'financialConditions',
  'paymentTerms',
  'experienceRequirements',
  'turnoverRequirements',
  'manpowerRequirements',
  'licensesRequired',
  'registrationsRequired',
  'certificationsRequired',
  'statutoryRequirements',
  'complianceRequirements',
  'importantDates',
  'penalties',
  'penaltyClauses',
  'liquidatedDamages',
  'performanceSecurity',
  'bankGuarantee',
  'risks',
  'contactDetails',
  'submissionMode',
];

export const LIST_FIELDS: IntelligenceFieldKey[] = [
  'eligibilityCriteria',
  'requiredDocuments',
  'technicalRequirements',
  'technicalConditions',
  'financialRequirements',
  'financialConditions',
  'experienceRequirements',
  'turnoverRequirements',
  'manpowerRequirements',
  'licensesRequired',
  'registrationsRequired',
  'certificationsRequired',
  'statutoryRequirements',
  'complianceRequirements',
  'importantDates',
  'penaltyClauses',
  'risks',
];

export const PASS_FIELDS: Record<ExtractionPass, IntelligenceFieldKey[]> = {
  rule: ALL_INTELLIGENCE_FIELDS,
  general: [
    'tenderName',
    'organization',
    'department',
    'issuingAuthority',
    'tenderNumber',
    'tenderReferenceNumber',
    'tenderType',
    'tenderCategory',
    'contractDuration',
    'workLocation',
    'serviceCategory',
    'contactDetails',
    'submissionMode',
  ],
  scope: ['scopeOfWork'],
  eligibility: [
    'eligibilityCriteria',
    'experienceRequirements',
    'turnoverRequirements',
    'manpowerRequirements',
    'licensesRequired',
    'registrationsRequired',
    'certificationsRequired',
    'statutoryRequirements',
    'technicalRequirements',
    'technicalConditions',
  ],
  financial: [
    'estimatedTenderValue',
    'emdAmount',
    'emdExemption',
    'bidSecurityAmount',
    'tenderFee',
    'financialRequirements',
    'financialConditions',
    'paymentTerms',
    'performanceSecurity',
    'bankGuarantee',
    'liquidatedDamages',
    'penalties',
  ],
  documents: ['requiredDocuments'],
  dates: [
    'tenderPublishDate',
    'preBidMeetingDate',
    'bidSubmissionStartDate',
    'bidSubmissionDate',
    'bidOpeningDate',
    'technicalBidOpeningDate',
    'financialBidOpeningDate',
    'importantDates',
  ],
  compliance: ['complianceRequirements', 'statutoryRequirements', 'registrationsRequired'],
  risks: ['risks', 'penaltyClauses', 'penalties', 'liquidatedDamages'],
  executive: [],
};

/** AI passes only — rule pass runs separately. Executive pass uses summaries, not merged fields. */
export const AI_EXTRACTION_PASSES: ExtractionPass[] = [
  'general',
  'scope',
  'eligibility',
  'financial',
  'documents',
  'dates',
  'compliance',
  'risks',
];

export const EXTRACTION_PASSES: ExtractionPass[] = ['rule', ...AI_EXTRACTION_PASSES];

/** Fields that must be present before dashboard — triggers re-analysis of related pages. */
export const MANDATORY_FIELDS: IntelligenceFieldKey[] = [
  'tenderName',
  'tenderNumber',
  'estimatedTenderValue',
  'emdAmount',
  'bidSubmissionDate',
  'contractDuration',
  'turnoverRequirements',
  'experienceRequirements',
  'workLocation',
  'submissionMode',
  'tenderFee',
  'performanceSecurity',
  'statutoryRequirements',
];

export const CRITICAL_FIELDS: IntelligenceFieldKey[] = [
  ...MANDATORY_FIELDS,
  'eligibilityCriteria',
  'scopeOfWork',
  'organization',
];

export const CHUNK_SIZE_PAGES = 5;
export const CONFIDENCE_THRESHOLD = 0.65;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000;

export function buildFieldSchema(fields: IntelligenceFieldKey[]): string {
  const lines = fields.map(
    (f) =>
      `  "${f}": [{ "value": "exact text from document or null", "page": number, "confidence": 0.0-1.0 }]`
  );
  return `{\n${lines.join(',\n')}\n}`;
}

export function buildEmptyMerged(): Record<string, import('../../types/intelligence').MergedField> {
  const empty: Record<string, import('../../types/intelligence').MergedField> = {};
  for (const field of ALL_INTELLIGENCE_FIELDS) {
    empty[field] = {
      value: null,
      sourcePages: [],
      confidence: 0,
      validated: false,
      allExtractions: [],
    };
  }
  return empty;
}
