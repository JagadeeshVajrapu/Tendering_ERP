export const TENDER_INTELLIGENCE_TYPES = [
  'GeM',
  'CPWD',
  'Manpower',
  'Security',
  'Housekeeping',
  'Facility Management',
  'Horticulture',
  'Civil',
  'Electrical',
  'Mechanical',
  'IT',
  'Procurement',
  'Railway',
  'Defence',
  'Healthcare',
  'Education',
  'Consultancy',
  'Supply',
] as const;

export type TenderIntelligenceType = (typeof TENDER_INTELLIGENCE_TYPES)[number];

export const TENDER_DOCUMENT_SECTIONS = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Technical Specifications',
  'Annexures',
  'Tender Specific',
] as const;

export type TenderDocumentSectionType = (typeof TENDER_DOCUMENT_SECTIONS)[number];

export interface TenderDocumentSection {
  section: TenderDocumentSectionType;
  confidence: number;
  pages: number[];
  startPage?: number;
  endPage?: number;
  matchedKeywords: string[];
}

export interface TenderIntelligenceLayerResult {
  tenderType: TenderIntelligenceType | '';
  confidence: number;
  sections: TenderDocumentSection[];
}

export interface TenderIntelligenceLayerRecord extends TenderIntelligenceLayerResult {
  documentId: string;
  tenderId: string;
  pagesScanned: number;
  typeScores: Record<string, number>;
  analyzedAt: string;
  pageClassifications?: Array<{
    page: number;
    primarySection: string;
    primaryConfidence: number;
    sections: Array<{ section: string; confidence: number; matchedKeywords?: string[] }>;
  }>;
}
