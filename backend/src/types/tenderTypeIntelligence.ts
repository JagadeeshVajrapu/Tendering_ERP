/** Primary tender types detected by the Tender-Type Intelligence Engine. */
export const TENDER_TYPE_INTELLIGENCE_TYPES = [
  'GeM',
  'CPWD',
  'Manpower',
  'Security',
  'Housekeeping',
  'Facility Management',
  'Civil',
  'Electrical',
  'Mechanical',
  'IT',
  'Procurement',
  'Railway',
  'Healthcare',
  'Education',
  'Consultancy',
] as const;

export type TenderTypeIntelligenceType = (typeof TENDER_TYPE_INTELLIGENCE_TYPES)[number];

export interface TenderTypeAliasMapping {
  from: string[];
  to: string;
}

export interface TenderTypeProfile {
  tenderType: TenderTypeIntelligenceType | '';
  parameters: string[];
  rules: string[];
  aliases: TenderTypeAliasMapping[];
}

export interface TenderTypeLibrary {
  tenderType: TenderTypeIntelligenceType | '';
  libraryLoaded: string;
  focusParameters: string[];
  aliases: TenderTypeAliasMapping[];
  extractionRules: string[];
  /** Type-specific parameters to prioritize during extraction for this tender type. */
  searchParameters: string[];
}

export interface TenderTypeLibraryMatchOutput {
  tenderType: string;
  libraryLoaded: string;
  parameter: string;
  value: string;
  typeLibraryMatch: boolean;
  confidenceBoost: number;
}

export interface TenderTypeIntelligenceResult {
  tenderType: TenderTypeIntelligenceType | '';
  confidence: number;
  typeScores: Record<string, number>;
  matchedKeywords: string[];
  profile: TenderTypeProfile;
  library: TenderTypeLibrary;
  extractionContext: string;
  libraryContext: string;
  aliasHintsText: string;
}
