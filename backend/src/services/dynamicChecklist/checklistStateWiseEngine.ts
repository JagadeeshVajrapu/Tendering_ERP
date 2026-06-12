import { DynamicChecklistCatalogItem } from '../../types/dynamicChecklist';
import { INDIAN_STATES } from './checklistIndianStates';

interface StateWiseGroup {
  prefix: string;
  headerId: string;
  title: string;
  keywords: string[];
}

const STATE_WISE_GROUPS: StateWiseGroup[] = [
  {
    prefix: 'gst',
    headerId: 'gst_header',
    title: 'GST (State wise)',
    keywords: ['gst', 'gstin', 'gst registration', 'goods and services tax'],
  },
  {
    prefix: 'pf',
    headerId: 'pf_registration_header',
    title: 'PF Registration',
    keywords: ['pf registration', 'epf registration', 'provident fund', 'epf'],
  },
  {
    prefix: 'esic',
    headerId: 'esic_registration_header',
    title: 'ESIC Registration',
    keywords: ['esic registration', 'esi registration', 'esic', 'esi'],
  },
];

export function buildStateWiseGroupItems(
  prefix: 'gst' | 'pf' | 'esic'
): DynamicChecklistCatalogItem[] {
  const group = STATE_WISE_GROUPS.find((g) => g.prefix === prefix);
  if (!group) return [];

  const items: DynamicChecklistCatalogItem[] = [
    {
      id: group.headerId,
      name: group.title,
      keywords: group.keywords,
      categoryId: 'company_documents',
      defaultRequired: false,
    },
  ];

  for (const state of INDIAN_STATES) {
    items.push({
      id: `${group.prefix}_state_${state.code}`,
      name: state.name,
      keywords: [...group.keywords, state.name.toLowerCase(), group.prefix, state.code],
      categoryId: 'company_documents',
      defaultRequired: false,
    });
  }

  return items;
}

export function buildStateWiseCatalogItems(): DynamicChecklistCatalogItem[] {
  return [
    ...buildStateWiseGroupItems('gst'),
    ...buildStateWiseGroupItems('pf'),
    ...buildStateWiseGroupItems('esic'),
  ];
}

export function resolveStateOptionParentId(itemId: string): string | undefined {
  if (itemId.startsWith('gst_state_')) return 'gst_header';
  if (itemId.startsWith('pf_state_')) return 'pf_registration_header';
  if (itemId.startsWith('esic_state_')) return 'esic_registration_header';
  return undefined;
}
