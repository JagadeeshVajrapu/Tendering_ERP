export interface RequirementChecklistItem {
  id: string;
  name: string;
  categoryId: string;
  categoryTitle: string;
  required: boolean;
  mentionedInTender: boolean;
  source: 'baseline' | 'service_category' | 'ocr_detected';
  sourceText?: string;
  page?: number;
}

export interface RequirementChecklistCategory {
  id: string;
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
