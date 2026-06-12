import { DynamicChecklistCatalogItem } from '../../types/dynamicChecklist';
import {
  formatItrFyLabel,
  generateRecentFinancialYearsDescending,
} from './checklistFinancialYearUtils';

export function buildItrCatalogItems(): DynamicChecklistCatalogItem[] {
  const years = generateRecentFinancialYearsDescending(5, 2021);
  const items: DynamicChecklistCatalogItem[] = [
    {
      id: 'itr_header',
      name: 'ITR',
      keywords: ['itr', 'income tax return'],
      categoryId: 'financial_documents',
      defaultRequired: false,
      critical: true,
    },
  ];

  for (const fy of years) {
    items.push({
      id: `itr_${fy.id}`,
      name: formatItrFyLabel(fy.startYear),
      keywords: ['itr', 'income tax return', fy.label, formatItrFyLabel(fy.startYear).toLowerCase()],
      categoryId: 'financial_documents',
      defaultRequired: false,
      critical: true,
    });
  }

  return items;
}
