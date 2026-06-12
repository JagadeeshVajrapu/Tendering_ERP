export type DynamicChecklistDisplayStatus =
  | 'required'
  | 'optional'
  | 'available'
  | 'missing'
  | 'uploaded'
  | 'verified';

export type DynamicChecklistItemStatus =
  | 'optional'
  | 'missing'
  | 'uploaded'
  | 'expired'
  | 'approved'
  | 'rejected'
  | 'pending_review';

export type DynamicChecklistItemType =
  | 'document'
  | 'selection_header'
  | 'state_option'
  | 'iso_option'
  | 'itr_year'
  | 'experience_header'
  | 'experience_year'
  | 'compliance_header'
  | 'compliance_year';

export type DynamicChecklistItemSource =
  | 'master_dataset'
  | 'tender_requirement'
  | 'service_category'
  | 'baseline'
  | 'dynamic_discovery';

export interface DynamicChecklistItem {
  id: string;
  name: string;
  categoryId: string;
  categoryTitle: string;
  itemType?: DynamicChecklistItemType;
  parentId?: string;
  financialYear?: string;
  suggested?: boolean;
  required: boolean;
  optional: boolean;
  uploaded: boolean;
  missing: boolean;
  expired: boolean;
  critical: boolean;
  status: DynamicChecklistItemStatus;
  displayStatus?: DynamicChecklistDisplayStatus | string;
  matchedDocumentId?: string;
  matchedFileName?: string;
  uploadedAt?: string;
  source: DynamicChecklistItemSource;
  sourceParameter?: string;
  reviewNote?: string;
  markedComplete?: boolean;
}

export interface DynamicChecklistCategorySummary {
  required: number;
  completed: number;
  pending: number;
  compliancePercentage: number;
}

export interface DynamicChecklistCategory {
  id: string;
  title: string;
  subtitle?: string;
  items: DynamicChecklistItem[];
  summary?: DynamicChecklistCategorySummary;
}

export interface DynamicChecklistSummary {
  required: number;
  optional: number;
  uploaded: number;
  missing: number;
  expired: number;
  approved: number;
  rejected: number;
  pendingReview: number;
  completed: number;
  pending?: number;
  criticalMissing: number;
  readinessScore: number;
  readinessLabel: string;
  compliancePercentage?: number;
  minimumExperienceYears?: number;
  suggestedExperienceYears?: string[];
}

export interface DynamicChecklistAlert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  itemId: string;
  itemName: string;
  categoryTitle: string;
  message: string;
}

export interface DynamicChecklistResult {
  documentId: string;
  tenderId: string;
  serviceCategory: string;
  schemaVersion?: number;
  dataSource?: string;
  categories: DynamicChecklistCategory[];
  summary: DynamicChecklistSummary;
  alerts: DynamicChecklistAlert[];
  generatedAt: string;
}
