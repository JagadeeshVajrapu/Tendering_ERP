import { Types } from 'mongoose';
import { TenderDocument, ITenderDocument } from '../../models/TenderDocument';
import { RequirementDiscoveryResult } from '../../types/requirementDiscovery';
import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';
import {
  DynamicChecklistAlert,
  DynamicChecklistCatalogItem,
  DynamicChecklistCategory,
  DynamicChecklistCategoryDefinition,
  DynamicChecklistCategoryId,
  DynamicChecklistItem,
  DynamicChecklistItemStatus,
  DynamicChecklistResult,
  DynamicChecklistSummary,
} from '../../types/dynamicChecklist';
import { DYNAMIC_CHECKLIST_CATALOG, DYNAMIC_CHECKLIST_CATEGORY_ORDER } from './dynamicChecklistCatalog';
import {
  discoverItemsFromDynamicParameters,
  discoverItemsFromParameterRules,
} from './dynamicChecklistParameterRules';
import {
  buildExperienceYearCatalogItems,
  getSuggestedExperienceYears,
  parseMinimumExperienceYears,
} from './checklistExperienceYearEngine';
import {
  buildStateWiseCatalogItems,
  buildStateWiseGroupItems,
  resolveStateOptionParentId,
} from './checklistStateWiseEngine';
import { buildIsoCatalogItems } from './checklistIsoEngine';
import { buildItrCatalogItems } from './checklistItrEngine';
import {
  DynamicChecklistCategorySummary,
  DynamicChecklistDisplayStatus,
  DynamicChecklistItemType,
} from '../../types/dynamicChecklist';
export interface ChecklistWorkflowState {
  itemId: string;
  markedComplete?: boolean;
  markedCompleteAt?: Date;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewedBy?: unknown;
  reviewedAt?: Date;
  reviewNote?: string;
  linkedDocumentId?: unknown;
}

export const ENTERPRISE_CHECKLIST_SCHEMA_VERSION = 5;

const CERT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000;

interface UploadMatch {
  documentId: string;
  fileName: string;
  uploadedAt: Date;
  expired: boolean;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const norm = normalize(text);
  return keywords.some((kw) => norm.includes(normalize(kw)));
}

function docUploadedAt(doc: ITenderDocument): Date {
  const withTs = doc as ITenderDocument & { createdAt?: Date };
  if (withTs.createdAt) return new Date(withTs.createdAt);
  return (doc._id as Types.ObjectId).getTimestamp();
}

function isExpiredDoc(doc: ITenderDocument, itemId: string): boolean {
  const certLike = /certificate|gst|pan|msme|iso|pf|esic|solvency|turnover|itr|license/i.test(itemId);
  if (!certLike) return false;
  return Date.now() - docUploadedAt(doc).getTime() > CERT_EXPIRY_MS;
}

function findUploadMatch(
  itemId: string,
  keywords: string[],
  uploads: ITenderDocument[],
  workflow?: ChecklistWorkflowState
): UploadMatch | null {
  if (workflow?.linkedDocumentId) {
    const linked = uploads.find((d) => String(d._id) === String(workflow.linkedDocumentId));
    if (linked) {
      return {
        documentId: String(linked._id),
        fileName: linked.originalName,
        uploadedAt: docUploadedAt(linked),
        expired: isExpiredDoc(linked, itemId),
      };
    }
  }

  for (const doc of uploads) {
    const haystack = `${doc.originalName} ${doc.fileName}`;
    if (matchesKeywords(haystack, keywords)) {
      return {
        documentId: String(doc._id),
        fileName: doc.originalName,
        uploadedAt: docUploadedAt(doc),
        expired: isExpiredDoc(doc, itemId),
      };
    }
  }
  return null;
}

function isRequiredFromRequirements(
  itemId: string,
  itemName: string,
  requirements: RequirementDiscoveryResult | null
): boolean {
  if (!requirements) return false;
  for (const cat of requirements.categories) {
    for (const req of cat.items) {
      if (req.id === itemId || normalize(req.name) === normalize(itemName)) {
        return req.required || req.mentionedInTender;
      }
    }
  }
  return false;
}

function findMasterMatch(
  itemName: string,
  keywords: string[],
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): EnterpriseMasterDatasetEntry | undefined {
  if (!masterParameters?.length) return undefined;
  const norms = [normalize(itemName), ...keywords.map(normalize)];
  return masterParameters.find((p) => {
    const hay = normalize(`${p.parameter} ${p.normalizedParameter} ${p.value} ${p.sourceText}`);
    return norms.some((term) => term.length > 2 && hay.includes(term));
  });
}

function isRequiredFromMasterDataset(
  itemName: string,
  keywords: string[],
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): EnterpriseMasterDatasetEntry | undefined {
  return findMasterMatch(itemName, keywords, masterParameters);
}

function shouldIncludeExperience(
  serviceCategories: string[] | undefined,
  serviceCategory: string
): boolean {
  if (!serviceCategories?.length) return true;
  if (!serviceCategory) return false;
  return serviceCategories.some((c) => normalize(c) === normalize(serviceCategory));
}

function resolveStatus(
  required: boolean,
  uploaded: boolean,
  expired: boolean,
  workflow?: ChecklistWorkflowState
): DynamicChecklistItemStatus {
  if (workflow?.reviewStatus === 'approved') return 'approved';
  if (workflow?.reviewStatus === 'rejected') return 'rejected';
  if (!required) return 'optional';
  if (!uploaded && !workflow?.markedComplete) return 'missing';
  if (expired) return 'expired';
  if (uploaded && workflow?.reviewStatus === 'pending') return 'pending_review';
  if (uploaded || workflow?.markedComplete) return 'uploaded';
  return 'missing';
}

function resolveDisplayStatus(
  required: boolean,
  status: DynamicChecklistItemStatus,
  uploaded: boolean
): DynamicChecklistDisplayStatus {
  if (status === 'approved') return 'verified';
  if (status === 'uploaded' || uploaded) return 'uploaded';
  if (!required) return 'optional';
  if (status === 'missing') return 'missing';
  if (required) return 'required';
  return 'optional';
}

const SELECTION_HEADER_IDS = new Set([
  'gst_header',
  'pf_registration_header',
  'esic_registration_header',
  'iso_header',
  'itr_header',
]);

function resolveItemType(
  item: DynamicChecklistCatalogItem,
  categoryId: DynamicChecklistCategoryId
): DynamicChecklistItemType {
  if (SELECTION_HEADER_IDS.has(item.id)) return 'selection_header';
  if (item.id.endsWith('_header')) {
    if (categoryId === 'compliance_documents') return 'compliance_header';
    if (categoryId === 'technical_documents') return 'experience_header';
    return 'selection_header';
  }
  if (item.id.startsWith('gst_state_') || item.id.startsWith('pf_state_') || item.id.startsWith('esic_state_')) {
    return 'state_option';
  }
  if (item.id.startsWith('iso_')) return 'iso_option';
  if (item.id.startsWith('itr_fy_')) return 'itr_year';
  if (/_fy_\d{4}_\d{2}$/.test(item.id)) {
    if (categoryId === 'compliance_documents') return 'compliance_year';
    if (categoryId === 'technical_documents') return 'experience_year';
  }
  return 'document';
}

function isGroupHeader(itemType: DynamicChecklistItemType): boolean {
  return (
    itemType === 'selection_header' ||
    itemType === 'experience_header' ||
    itemType === 'compliance_header'
  );
}

function isYearItem(itemType: DynamicChecklistItemType): boolean {
  return (
    itemType === 'experience_year' ||
    itemType === 'compliance_year' ||
    itemType === 'itr_year'
  );
}

function resolveParentId(item: DynamicChecklistCatalogItem, itemType: DynamicChecklistItemType): string | undefined {
  if (itemType === 'state_option') return resolveStateOptionParentId(item.id);
  if (itemType === 'iso_option') return 'iso_header';
  if (itemType === 'itr_year') return 'itr_header';
  if (isYearItem(itemType)) return item.id.replace(/_fy_\d{4}_\d{2}$/, '_header');
  return undefined;
}

function enrichCatalogWithGroupedItems(
  catalog: DynamicChecklistCategoryDefinition[],
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): DynamicChecklistCategoryDefinition[] {
  const result = catalog.map((c) => ({ ...c, items: [...c.items] }));
  const company = result.find((c) => c.id === 'company_documents');
  const financial = result.find((c) => c.id === 'financial_documents');
  if (!company || !financial) return result;

  const byId = new Map(company.items.map((item) => [item.id, item]));
  const pick = (id: string) => byId.get(id);

  // Company Basic Documents — exact tender submission order
  company.items = [
    pick('moa'),
    pick('aoa'),
    ...buildStateWiseGroupItems('gst'),
    pick('cin'),
    pick('msme_certificate'),
    pick('shop_establishment'),
    ...buildIsoCatalogItems(masterParameters),
    ...buildStateWiseGroupItems('pf'),
    ...buildStateWiseGroupItems('esic'),
    pick('pan_company'),
    pick('pan_director_1'),
    pick('pan_director_2'),
  ].filter((item): item is DynamicChecklistCatalogItem => !!item);

  // Financial Documents — ITR group first, then remaining items in catalog order
  financial.items = [...buildItrCatalogItems(), ...financial.items];

  return result;
}

function computeCategorySummary(items: DynamicChecklistItem[]): DynamicChecklistCategorySummary {
  const actionable = items.filter((i) => !isGroupHeader(i.itemType || 'document'));
  const requiredItems = actionable.filter((i) => i.required);
  const completed = requiredItems.filter(
    (i) => (i.uploaded || i.status === 'approved') && !i.expired
  ).length;
  const pending = requiredItems.length - completed;
  const compliancePercentage = requiredItems.length
    ? Math.round((completed / requiredItems.length) * 100)
    : 100;

  return {
    required: requiredItems.length,
    completed,
    pending,
    compliancePercentage,
  };
}

function computeSummary(items: DynamicChecklistItem[]): DynamicChecklistSummary {
  const requiredItems = items.filter((i) => i.required);
  const uploaded = requiredItems.filter(
    (i) => (i.uploaded || i.status === 'approved') && !i.expired
  ).length;
  const missing = requiredItems.filter((i) => i.missing).length;
  const expired = requiredItems.filter((i) => i.expired).length;
  const approved = items.filter((i) => i.status === 'approved').length;
  const rejected = items.filter((i) => i.status === 'rejected').length;
  const pendingReview = items.filter((i) => i.status === 'pending_review').length;
  const optional = items.filter((i) => i.optional).length;
  const criticalMissing = requiredItems.filter((i) => i.critical && i.missing).length;
  const required = requiredItems.length;
  const completed = uploaded + approved;
  const pending = Math.max(0, required - completed);
  const readinessScore = required ? Math.round((completed / required) * 100) : 100;

  return {
    required,
    optional,
    uploaded,
    missing,
    expired,
    approved,
    rejected,
    pendingReview,
    completed,
    pending,
    criticalMissing,
    readinessScore,
    readinessLabel: `${readinessScore}% Ready`,
    compliancePercentage: readinessScore,
  };
}

function buildAlerts(items: DynamicChecklistItem[]): DynamicChecklistAlert[] {
  const alerts: DynamicChecklistAlert[] = [];

  for (const item of items) {
    if (item.required && item.missing) {
      alerts.push({
        type: item.critical ? 'critical_compliance_gap' : 'missing_document',
        severity: item.critical ? 'high' : 'medium',
        itemId: item.id,
        itemName: item.name,
        categoryTitle: item.categoryTitle,
        message: item.critical
          ? `Critical document missing: ${item.name}`
          : `Required document missing: ${item.name}`,
      });
    }
    if (item.expired) {
      alerts.push({
        type: 'expired_certificate',
        severity: 'high',
        itemId: item.id,
        itemName: item.name,
        categoryTitle: item.categoryTitle,
        message: `Certificate may be expired: ${item.name}`,
      });
    }
    if (item.status === 'pending_review') {
      alerts.push({
        type: 'pending_upload',
        severity: 'low',
        itemId: item.id,
        itemName: item.name,
        categoryTitle: item.categoryTitle,
        message: `Awaiting manager review: ${item.name}`,
      });
    }
    if (item.status === 'rejected') {
      alerts.push({
        type: 'pending_upload',
        severity: 'medium',
        itemId: item.id,
        itemName: item.name,
        categoryTitle: item.categoryTitle,
        message: `Re-upload requested: ${item.name}`,
      });
    }
  }

  return alerts.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}

function mergeCatalogWithDynamicItems(
  dynamicItems: DynamicChecklistCatalogItem[]
): DynamicChecklistCategoryDefinition[] {
  const catalog = DYNAMIC_CHECKLIST_CATALOG.map((cat) => ({
    ...cat,
    items: [...cat.items],
  }));

  for (const dyn of dynamicItems) {
    const targetId = dyn.categoryId || 'compliance_documents';
    let target = catalog.find((c) => c.id === targetId);
    if (!target) {
      target = catalog.find((c) => c.id === 'compliance_documents')!;
    }
    if (!target.items.some((i) => i.id === dyn.id)) {
      target.items.push(dyn);
    }
  }

  return catalog;
}

function buildChecklistItem(
  cat: DynamicChecklistCategoryDefinition,
  item: DynamicChecklistCatalogItem,
  ctx: {
    serviceCategory: string;
    requirements: RequirementDiscoveryResult | null;
    masterParameters: EnterpriseMasterDatasetEntry[] | null;
    uploads: ITenderDocument[];
    workflowMap: Map<string, ChecklistWorkflowState>;
    suggestedExperienceYearIds: Set<string>;
  }
): DynamicChecklistItem | null {
  const itemType = resolveItemType(item, cat.id);

  if (
    (cat.id === 'experience_documents' || cat.id === 'technical_documents') &&
    item.serviceCategories &&
    !shouldIncludeExperience(item.serviceCategories, ctx.serviceCategory)
  ) {
    return null;
  }

  const masterMatch = isRequiredFromMasterDataset(item.name, item.keywords, ctx.masterParameters);
  const fromRequirements = isRequiredFromRequirements(item.id, item.name, ctx.requirements);
  const fromService =
    !!item.serviceCategories?.length &&
    shouldIncludeExperience(item.serviceCategories, ctx.serviceCategory);
  const isDiscoveredItem = item.id.startsWith('dyn_') || PARAMETER_RULE_IDS.has(item.id);
  const isHeader = isGroupHeader(itemType);
  const isSuggestedYear = itemType === 'experience_year' && ctx.suggestedExperienceYearIds.has(item.id);
  const required =
    !isHeader &&
    (isDiscoveredItem ||
      fromRequirements ||
      !!masterMatch ||
      fromService ||
      isSuggestedYear ||
      !!item.defaultRequired);

  const workflow = ctx.workflowMap.get(item.id);
  const match = isHeader ? null : findUploadMatch(item.id, item.keywords, ctx.uploads, workflow);
  // Executive checkbox wins over filename auto-match (so uncheck works reliably).
  const uploaded = workflow
    ? !!workflow.markedComplete
    : !!match;
  const expired = !!match?.expired;
  const missing = required && !uploaded && !isHeader;
  const status = isHeader ? 'optional' : resolveStatus(required, uploaded, expired, workflow);
  const displayStatus = isHeader ? 'optional' : resolveDisplayStatus(required, status, uploaded);

  let source: DynamicChecklistItem['source'] = 'baseline';
  if (isDiscoveredItem) source = 'dynamic_discovery';
  else if (masterMatch) source = 'master_dataset';
  else if (fromRequirements) source = 'tender_requirement';
  else if (fromService || isSuggestedYear) source = 'service_category';

  const parentId = resolveParentId(item, itemType);
  const financialYear = isYearItem(itemType) ? item.name : undefined;

  return {
    id: item.id,
    name: item.name,
    categoryId: cat.id,
    categoryTitle: cat.title,
    itemType,
    parentId,
    financialYear,
    suggested: isSuggestedYear,
    required,
    optional: !required,
    uploaded,
    missing,
    expired,
    critical: !!item.critical || isSuggestedYear,
    status,
    displayStatus,
    matchedDocumentId: match?.documentId,
    matchedFileName: match?.fileName,
    uploadedAt: match?.uploadedAt.toISOString(),
    source,
    sourceParameter: masterMatch?.parameter,
    sourceText: masterMatch?.sourceText,
    reviewNote: workflow?.reviewNote,
    reviewedAt: workflow?.reviewedAt?.toISOString(),
    reviewedBy: workflow?.reviewedBy ? String(workflow.reviewedBy) : undefined,
    markedComplete: !!workflow?.markedComplete,
    markedCompleteAt: workflow?.markedCompleteAt?.toISOString(),
  };
}

const PARAMETER_RULE_IDS = new Set([
  'oem_authorization_letter',
  'manufacturer_authorization_form',
  'psara_license',
  'drone_license',
  'cloud_certification',
  'data_center_compliance',
]);

export async function buildEnterpriseDynamicChecklist(
  documentId: string,
  tenderId: string,
  serviceCategory: string,
  requirements: RequirementDiscoveryResult | null,
  masterParameters: EnterpriseMasterDatasetEntry[] | null,
  workflowStates: ChecklistWorkflowState[] = []
): Promise<DynamicChecklistResult> {
  const uploads = await TenderDocument.find({
    tenderId: new Types.ObjectId(tenderId),
    documentType: { $in: ['COMPLIANCE', 'PAYMENT_PROOF', 'OTHER'] },
  }).sort({ createdAt: -1 });

  const workflowMap = new Map(workflowStates.map((s) => [s.itemId, s]));

  const ruleItems = discoverItemsFromParameterRules(masterParameters || []);
  const experienceYearItems = buildExperienceYearCatalogItems(serviceCategory, masterParameters);
  const stateItems = buildStateWiseCatalogItems();
  const isoItems = buildIsoCatalogItems(masterParameters);
  const itrItems = buildItrCatalogItems();
  const existingIds = new Set(
    DYNAMIC_CHECKLIST_CATALOG.flatMap((c) => c.items.map((i) => i.id))
      .concat(ruleItems.map((i) => i.id))
      .concat(experienceYearItems.map((i) => i.id))
      .concat(stateItems.map((i) => i.id))
      .concat(isoItems.map((i) => i.id))
      .concat(itrItems.map((i) => i.id))
  );
  const dynamicItems = [
    ...ruleItems,
    ...experienceYearItems,
    ...discoverItemsFromDynamicParameters(masterParameters || [], existingIds),
  ];

  const suggestedExperienceYears = getSuggestedExperienceYears(masterParameters);
  const suggestedExperienceYearIds = new Set(
    experienceYearItems
      .filter((i) => i.defaultRequired && i.id.includes('_fy_'))
      .map((i) => i.id)
  );
  const minExperienceYears = parseMinimumExperienceYears(masterParameters);

  const catalog = enrichCatalogWithGroupedItems(
    mergeCatalogWithDynamicItems(dynamicItems),
    masterParameters
  );
  const allItems: DynamicChecklistItem[] = [];

  for (const cat of catalog) {
    for (const item of cat.items) {
      const built = buildChecklistItem(cat, item, {
        serviceCategory,
        requirements,
        masterParameters,
        uploads,
        workflowMap,
        suggestedExperienceYearIds,
      });
      if (built) allItems.push(built);
    }
  }

  const categories: DynamicChecklistCategory[] = DYNAMIC_CHECKLIST_CATEGORY_ORDER.map((catId) => {
    const def = catalog.find((c) => c.id === catId)!;
    const catItems = allItems.filter((i) => i.categoryId === catId);
    return {
      id: catId as DynamicChecklistCategoryId,
      title: def.title,
      subtitle: def.subtitle,
      items: catItems,
      summary: computeCategorySummary(catItems),
    };
  }).filter((c) => c.items.length > 0);

  const actionableItems = allItems.filter((i) => !isGroupHeader(i.itemType || 'document'));
  const summary = {
    ...computeSummary(actionableItems),
    minimumExperienceYears: minExperienceYears || undefined,
    suggestedExperienceYears: suggestedExperienceYears.map((fy) => fy.label),
  };
  const alerts = buildAlerts(actionableItems);

  return {
    documentId,
    tenderId,
    serviceCategory,
    schemaVersion: ENTERPRISE_CHECKLIST_SCHEMA_VERSION,
    dataSource: 'enterprise_master_dataset',
    categories,
    summary,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}
