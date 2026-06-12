import { DynamicChecklistCatalogItem, DynamicChecklistCategoryId } from '../../types/dynamicChecklist';
import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';

export interface ParameterChecklistRule {
  id: string;
  patterns: string[];
  item: Omit<DynamicChecklistCatalogItem, 'id'> & { id: string };
}

/** Master-dataset parameter patterns → checklist items (no hardcoded tender-type logic). */
export const PARAMETER_CHECKLIST_RULES: ParameterChecklistRule[] = [
  {
    id: 'oem_authorization',
    patterns: ['oem authorization', 'oem authorisation', 'oem certificate', 'authorized dealer'],
    item: {
      id: 'oem_authorization_letter',
      name: 'OEM Authorization Letter',
      keywords: ['oem', 'authorization', 'authorised dealer'],
      categoryId: 'legal_documents',
      critical: true,
    },
  },
  {
    id: 'maf_requirement',
    patterns: ['maf', 'manufacturer authorization form', 'manufacturer authorisation'],
    item: {
      id: 'manufacturer_authorization_form',
      name: 'Manufacturer Authorization Form',
      keywords: ['maf', 'manufacturer authorization'],
      categoryId: 'legal_documents',
      critical: true,
    },
  },
  {
    id: 'psara_requirement',
    patterns: ['psara', 'private security agency'],
    item: {
      id: 'psara_license',
      name: 'PSARA License',
      keywords: ['psara', 'private security agency'],
      categoryId: 'compliance_documents',
      critical: true,
    },
  },
  {
    id: 'drone_surveillance',
    patterns: ['drone surveillance', 'drone requirement', 'uav surveillance', 'drone license'],
    item: {
      id: 'drone_license',
      name: 'Drone License / UAV Authorization',
      keywords: ['drone', 'uav', 'dgca'],
      categoryId: 'compliance_documents',
      critical: true,
    },
  },
  {
    id: 'cloud_certification',
    patterns: ['cloud certification', 'cloud provider certificate', 'iso 27001 cloud'],
    item: {
      id: 'cloud_certification',
      name: 'Cloud Certification',
      keywords: ['cloud certification', 'iso 27001'],
      categoryId: 'compliance_documents',
      critical: false,
    },
  },
  {
    id: 'data_center',
    patterns: ['data center requirement', 'datacenter requirement', 'tier iii', 'tier 3 data center'],
    item: {
      id: 'data_center_compliance',
      name: 'Data Center Compliance Certificate',
      keywords: ['data center', 'datacenter', 'tier'],
      categoryId: 'compliance_documents',
      critical: false,
    },
  },
];

const DOCUMENT_LIKE_CATEGORIES = new Set([
  'Compliance',
  'Eligibility',
  'Experience',
  'Tender Specific',
  'Additional Tender Parameters',
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugify(text: string): string {
  return normalize(text).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function masterParameterMatchesPatterns(
  entry: EnterpriseMasterDatasetEntry,
  patterns: string[]
): boolean {
  const hay = normalize(
    `${entry.parameter} ${entry.normalizedParameter} ${entry.value} ${entry.sourceText}`
  );
  return patterns.some((p) => hay.includes(normalize(p)));
}

export function discoverItemsFromParameterRules(
  masterParameters: EnterpriseMasterDatasetEntry[]
): DynamicChecklistCatalogItem[] {
  const items: DynamicChecklistCatalogItem[] = [];
  const seen = new Set<string>();

  for (const rule of PARAMETER_CHECKLIST_RULES) {
    const matched = masterParameters.some((p) => masterParameterMatchesPatterns(p, rule.patterns));
    if (!matched) continue;
    if (seen.has(rule.item.id)) continue;
    seen.add(rule.item.id);
    items.push({ ...rule.item });
  }

  return items;
}

function looksLikeDocumentRequirement(entry: EnterpriseMasterDatasetEntry): boolean {
  if (!DOCUMENT_LIKE_CATEGORIES.has(entry.category)) return false;
  const hay = normalize(`${entry.parameter} ${entry.value}`);
  return /license|certificate|authorization|authorisation|registration|affidavit|undertaking|declaration|proof|document|form|returns|clearance|approval|compliance|warranty|guarantee|bond|insurance|experience|work order|completion/i.test(
    hay
  );
}

/** Discover additional checklist items from unmatched dynamic master-dataset parameters. */
export function discoverItemsFromDynamicParameters(
  masterParameters: EnterpriseMasterDatasetEntry[],
  existingIds: Set<string>
): DynamicChecklistCatalogItem[] {
  const items: DynamicChecklistCatalogItem[] = [];

  for (const entry of masterParameters) {
    if (entry.parameterType !== 'dynamic' && entry.validationStatus !== 'VALID_DYNAMIC_PARAMETER') {
      continue;
    }
    if (!looksLikeDocumentRequirement(entry)) continue;

    const id = `dyn_${slugify(entry.normalizedParameter || entry.parameter)}`;
    if (existingIds.has(id)) continue;
    existingIds.add(id);

    const categoryId = inferCategoryFromParameter(entry);

    items.push({
      id,
      name: entry.parameter,
      keywords: [entry.parameter, entry.normalizedParameter, entry.value].filter(Boolean),
      categoryId,
      critical: entry.category === 'Compliance' || entry.category === 'Tender Specific',
    });
  }

  return items;
}

function inferCategoryFromParameter(entry: EnterpriseMasterDatasetEntry): DynamicChecklistCategoryId {
  const cat = entry.category;
  if (cat === 'Financial') return 'financial_documents';
  if (cat === 'Compliance') return 'compliance_documents';
  if (cat === 'Experience' || cat === 'Eligibility') return 'technical_documents';
  if (cat === 'Tender Specific') return 'tender_documents';
  if (/affidavit|undertaking|authorization|declaration|integrity|blacklist/i.test(entry.parameter)) {
    return 'legal_documents';
  }
  return 'compliance_documents';
}
