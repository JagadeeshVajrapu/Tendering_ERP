/** Automatic classification groups for discovered parameters. */
export type ParameterGroup =
  | 'General Information'
  | 'Financial Information'
  | 'Important Dates'
  | 'Eligibility Criteria'
  | 'Technical Requirements'
  | 'Compliance Requirements'
  | 'Contact Information';

export const PARAMETER_GROUP_ORDER: ParameterGroup[] = [
  'General Information',
  'Financial Information',
  'Important Dates',
  'Eligibility Criteria',
  'Technical Requirements',
  'Compliance Requirements',
  'Contact Information',
];

export interface DiscoveredParameter {
  parameterName: string;
  parameterValue: string;
  pageNumber: number;
  sourceText: string;
  confidence: number;
  /** Parameter group from the grouping engine. */
  category: ParameterGroup;
}

export interface ParameterDiscoveryResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  totalFound: number;
  parameters: DiscoveredParameter[];
  grouped: Record<ParameterGroup, DiscoveredParameter[]>;
}
