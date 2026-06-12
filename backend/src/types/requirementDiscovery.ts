export type RequirementCategoryId =
  | 'company_documents'
  | 'financial_documents'
  | 'experience_documents'
  | 'legal_documents';

export interface RequirementCatalogItem {
  id: string;
  name: string;
  keywords: string[];
  serviceCategories?: string[];
}

export interface RequirementCategoryDefinition {
  id: RequirementCategoryId;
  title: string;
  items: RequirementCatalogItem[];
}

export interface RequirementChecklistItem {
  id: string;
  name: string;
  categoryId: RequirementCategoryId;
  categoryTitle: string;
  required: boolean;
  mentionedInTender: boolean;
  source: 'baseline' | 'service_category' | 'ocr_detected';
  sourceText?: string;
  page?: number;
}

export interface RequirementChecklistCategory {
  id: RequirementCategoryId;
  title: string;
  items: RequirementChecklistItem[];
}

export interface RequirementDiscoveryResult {
  documentId: string;
  tenderId: string;
  serviceCategory: string;
  categories: RequirementChecklistCategory[];
  totalItems: number;
  requiredCount: number;
  mentionedInTenderCount: number;
  discoveredAt: string;
}
