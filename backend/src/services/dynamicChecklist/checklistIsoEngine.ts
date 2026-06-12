import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';
import { DynamicChecklistCatalogItem } from '../../types/dynamicChecklist';

export interface IsoCertificateDefinition {
  id: string;
  name: string;
  keywords: string[];
}

/** Common ISO certificates referenced in Indian government & service tenders. */
export const ISO_CERTIFICATE_CATALOG: IsoCertificateDefinition[] = [
  { id: 'iso_9001', name: 'ISO 9001 (Quality Management)', keywords: ['iso 9001', 'iso9001', 'quality management system'] },
  { id: 'iso_27001', name: 'ISO 27001 (Information Security)', keywords: ['iso 27001', 'iso27001', 'information security'] },
  { id: 'iso_14001', name: 'ISO 14001 (Environmental)', keywords: ['iso 14001', 'iso14001', 'environmental management'] },
  { id: 'iso_45001', name: 'ISO 45001 (Occupational Health & Safety)', keywords: ['iso 45001', 'iso45001', 'ohsas', 'occupational health'] },
  { id: 'iso_20000', name: 'ISO 20000 (IT Service Management)', keywords: ['iso 20000', 'iso20000', 'itsm'] },
  { id: 'iso_22000', name: 'ISO 22000 (Food Safety)', keywords: ['iso 22000', 'food safety'] },
  { id: 'iso_50001', name: 'ISO 50001 (Energy Management)', keywords: ['iso 50001', 'energy management'] },
  { id: 'iso_other', name: 'Other ISO Certificate', keywords: ['iso certificate', 'iso certification', 'iso certified'] },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isIsoMentionedInTender(
  iso: IsoCertificateDefinition,
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): boolean {
  if (!masterParameters?.length) return false;

  const patterns = iso.keywords.map(normalize);
  return masterParameters.some((p) => {
    const hay = normalize(`${p.parameter} ${p.normalizedParameter} ${p.value} ${p.sourceText}`);
    return patterns.some((kw) => hay.includes(kw));
  });
}

function isGenericIsoMentioned(masterParameters: EnterpriseMasterDatasetEntry[] | null): boolean {
  if (!masterParameters?.length) return false;
  return masterParameters.some((p) => {
    const hay = normalize(`${p.parameter} ${p.value} ${p.sourceText}`);
    return /\biso\b/.test(hay) && /certif|9001|27001|14001|45001/.test(hay);
  });
}

export function buildIsoCatalogItems(
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): DynamicChecklistCatalogItem[] {
  const genericIso = isGenericIsoMentioned(masterParameters);
  const items: DynamicChecklistCatalogItem[] = [
    {
      id: 'iso_header',
      name: 'ISO Certificates (ISO 9001, 27001, etc.)',
      keywords: ['iso', 'iso certificate', 'iso certification'],
      categoryId: 'company_documents',
      defaultRequired: genericIso,
    },
  ];

  for (const iso of ISO_CERTIFICATE_CATALOG) {
    const mentioned = isIsoMentionedInTender(iso, masterParameters) || (genericIso && iso.id === 'iso_other');
    items.push({
      id: iso.id,
      name: iso.name,
      keywords: iso.keywords,
      categoryId: 'company_documents',
      defaultRequired: mentioned,
      critical: mentioned,
    });
  }

  return items;
}
