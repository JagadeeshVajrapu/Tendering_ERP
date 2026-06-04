import { ProductionFieldDefinition } from '../intelligence/fieldDefinitions';

export interface CandidateDetectionProfile {
  fieldName: string;
  fieldId: string;
}

/** Fields searched before OpenAI / rule extraction. */
export const CANDIDATE_DETECTION_PROFILES: CandidateDetectionProfile[] = [
  { fieldName: 'Tender Number', fieldId: 'tenderNumber' },
  { fieldName: 'NIT Number', fieldId: 'nitNumber' },
  { fieldName: 'EMD', fieldId: 'emdAmount' },
  { fieldName: 'Tender Value', fieldId: 'estimatedTenderValue' },
  { fieldName: 'Department', fieldId: 'department' },
  { fieldName: 'Organization', fieldId: 'organization' },
  { fieldName: 'Bid Submission Date', fieldId: 'bidSubmissionDate' },
  { fieldName: 'Bid Opening Date', fieldId: 'bidOpeningDate' },
  { fieldName: 'Pre-Bid Meeting Date', fieldId: 'preBidMeetingDate' },
  { fieldName: 'Submission Start Date', fieldId: 'bidSubmissionStartDate' },
  { fieldName: 'Eligibility', fieldId: 'eligibilityCriteria' },
  { fieldName: 'Experience', fieldId: 'experienceRequirements' },
  { fieldName: 'Turnover', fieldId: 'turnoverRequirements' },
];

/** Supplementary field defs not in the main production registry. */
export const CANDIDATE_DETECTION_FIELD_DEFS: ProductionFieldDefinition[] = [
  {
    id: 'nitNumber',
    label: 'NIT Number',
    mergeKey: 'tenderNumber',
    section: 'general',
    valueType: 'text',
    labels: ['nit no', 'nit number', 'notice inviting tender no', 'nit id'],
    patterns: [
      /nit\s*(?:no|number|id|ref)[.:\s]*([A-Z0-9][A-Z0-9/\-_.]{2,40})/i,
      /notice\s+inviting\s+tender\s*(?:no|number)[.:\s]*([A-Z0-9][A-Z0-9/\-_.]{2,40})/i,
    ],
    pageHints: ['nit', 'notice', 'tender'],
    maxLength: 80,
  },
  {
    id: 'eligibilityCriteria',
    label: 'Eligibility Criteria',
    mergeKey: 'eligibilityCriteria',
    section: 'eligibility',
    valueType: 'list',
    labels: [
      'eligibility criteria',
      'qualification criteria',
      'eligibility requirement',
      'pre-qualification criteria',
      'minimum eligibility',
    ],
    patterns: [
      /(?:eligibility|qualification)\s+criteria[^:\n]{0,40}[:\s]+([^\n]{10,400})/i,
      /(?:eligible|qualification)\s+(?:bidder|contractor)[^:\n]{0,40}[:\s]+([^\n]{10,400})/i,
    ],
    pageHints: ['eligibility', 'qualification', 'pre-qualification'],
    maxLength: 400,
    listMaxItems: 6,
  },
];
