/** NIT fields eligible for per-field GPT-4o verification (no full document). */
export const OPENAI_VERIFICATION_FIELDS = [
  'Tender Number',
  'NIT Number',
  'Department',
  'Organization',
  'Work Name',
  'EMD',
  'Tender Value',
  'Bid Dates',
  'Eligibility',
  'Turnover',
  'Experience',
] as const;

export type OpenAiVerificationFieldName = (typeof OPENAI_VERIFICATION_FIELDS)[number];
