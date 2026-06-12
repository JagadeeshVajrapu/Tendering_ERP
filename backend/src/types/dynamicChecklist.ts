export type DynamicChecklistCategoryId =
  | 'company_documents'
  | 'financial_documents'
  | 'technical_documents'
  | 'compliance_documents'
  | 'experience_documents'
  | 'tender_documents'
  | 'legal_documents';

export type DynamicChecklistDisplayStatus =
  | 'required'
  | 'optional'
  | 'available'
  | 'missing'
  | 'uploaded'
  | 'verified';

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

export type DynamicChecklistItemStatus =
  | 'optional'
  | 'missing'
  | 'uploaded'
  | 'expired'
  | 'approved'
  | 'rejected'
  | 'pending_review';

export type DynamicChecklistItemSource =
  | 'master_dataset'
  | 'tender_requirement'
  | 'service_category'
  | 'baseline'
  | 'dynamic_discovery';

export type DynamicChecklistAlertType =
  | 'missing_document'
  | 'expired_certificate'
  | 'pending_upload'
  | 'critical_compliance_gap';

export interface DynamicChecklistCatalogItem {
  id: string;
  name: string;
  keywords: string[];
  serviceCategories?: string[];
  defaultRequired?: boolean;
  critical?: boolean;
  categoryId?: DynamicChecklistCategoryId;
}

export interface DynamicChecklistCategoryDefinition {
  id: DynamicChecklistCategoryId;
  title: string;
  subtitle?: string;
  items: DynamicChecklistCatalogItem[];
}

export interface DynamicChecklistItem {
  id: string;
  name: string;
  categoryId: DynamicChecklistCategoryId;
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
  displayStatus: DynamicChecklistDisplayStatus;
  matchedDocumentId?: string;
  matchedFileName?: string;
  uploadedAt?: string;
  source: DynamicChecklistItemSource;
  sourceParameter?: string;
  sourceText?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  markedComplete?: boolean;
  markedCompleteAt?: string;
}

export interface DynamicChecklistCategorySummary {
  required: number;
  completed: number;
  pending: number;
  compliancePercentage: number;
}

export interface DynamicChecklistCategory {
  id: DynamicChecklistCategoryId;
  title: string;
  subtitle?: string;
  items: DynamicChecklistItem[];
  summary: DynamicChecklistCategorySummary;
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
  pending: number;
  criticalMissing: number;
  readinessScore: number;
  readinessLabel: string;
  compliancePercentage: number;
  minimumExperienceYears?: number;
  suggestedExperienceYears?: string[];
}

export interface DynamicChecklistAlert {
  type: DynamicChecklistAlertType;
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
  schemaVersion: number;
  dataSource: 'enterprise_master_dataset';
  categories: DynamicChecklistCategory[];
  summary: DynamicChecklistSummary;
  alerts: DynamicChecklistAlert[];
  generatedAt: string;
}

export interface ChecklistItemWorkflowUpdate {
  itemId: string;
  action: 'mark_complete' | 'unmark_complete' | 'approve' | 'reject' | 'request_reupload';
  note?: string;
  documentId?: string;
}
