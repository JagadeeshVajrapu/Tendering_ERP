export const TENDER_SERVICE_CATEGORIES = [
  'Security Services',
  'Manpower Services',
  'Housekeeping Services',
  'Facility Management',
  'Horticulture',
  'Civil Works',
  'Electrical Works',
  'Mechanical Works',
  'IT Services',
  'Supply Tenders',
  'Consultancy',
  'Healthcare',
  'Education',
  'Transportation',
  'Mixed Services',
  // Legacy aliases kept for backward compatibility
  'AMC',
  'MEP',
] as const;

export type TenderServiceCategory = (typeof TENDER_SERVICE_CATEGORIES)[number];

export interface TenderServiceCategoryDefinition {
  category: TenderServiceCategory;
  keywords: string[];
  typicalDynamicParameters?: string[];
}

export interface TenderServiceClassificationResult {
  serviceCategory: TenderServiceCategory | '';
  confidence: number;
  matchedKeywords: string[];
  categoryScores: Record<string, number>;
}

export interface TenderServiceClassificationRecord extends TenderServiceClassificationResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  classifiedAt: string;
}
