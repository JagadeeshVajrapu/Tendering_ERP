import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';
import { parseExperienceYears } from '../../utils/parseAmount';
import {
  FinancialYear,
  generateFinancialYearsDescending,
  suggestExperienceYears,
} from './checklistFinancialYearUtils';
import { DynamicChecklistCatalogItem } from '../../types/dynamicChecklist';

export interface ExperienceCategoryDefinition {
  id: string;
  name: string;
  serviceCategories: string[];
  keywords: string[];
}

export const EXPERIENCE_CATEGORIES: ExperienceCategoryDefinition[] = [
  {
    id: 'security_experience',
    name: 'Security Experience',
    serviceCategories: ['Security Services', 'Security'],
    keywords: ['security experience', 'security work order', 'security services experience'],
  },
  {
    id: 'housekeeping_experience',
    name: 'Housekeeping Experience',
    serviceCategories: ['Housekeeping Services', 'Housekeeping'],
    keywords: ['housekeeping experience', 'cleaning experience'],
  },
  {
    id: 'horticulture_experience',
    name: 'Horticulture Experience',
    serviceCategories: ['Horticulture Services', 'Horticulture'],
    keywords: ['horticulture experience', 'landscaping experience'],
  },
  {
    id: 'manpower_experience',
    name: 'Manpower Experience',
    serviceCategories: ['Manpower Services', 'Manpower'],
    keywords: ['manpower experience', 'labour experience', 'labor experience'],
  },
];

const EXPERIENCE_PARAM_KEYS = [
  'experienceRequirement',
  'experienceRequirements',
  'minimumExperience',
  'technicalExperience',
  'pastExperience',
  'similarWorkExperience',
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseMinimumExperienceYears(
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): number {
  if (!masterParameters?.length) return 0;

  for (const key of EXPERIENCE_PARAM_KEYS) {
    const match = masterParameters.find(
      (p) =>
        normalize(p.parameter) === normalize(key) ||
        normalize(p.normalizedParameter || '') === normalize(key)
    );
    if (match?.value) {
      const years = parseExperienceYears(match.value);
      if (years > 0) return years;
    }
  }

  for (const p of masterParameters) {
    const hay = normalize(`${p.parameter} ${p.value}`);
    if (/experience|similar\s+work|past\s+experience/.test(hay)) {
      const years = parseExperienceYears(p.value);
      if (years > 0) return years;
    }
  }

  return 0;
}

export function buildExperienceYearCatalogItems(
  serviceCategory: string,
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): DynamicChecklistCatalogItem[] {
  const minYears = parseMinimumExperienceYears(masterParameters);
  const suggested = suggestExperienceYears(minYears);
  const suggestedIds = new Set(suggested.map((fy) => fy.id));
  const allYears = generateFinancialYearsDescending(2001);
  const items: DynamicChecklistCatalogItem[] = [];

  for (const cat of EXPERIENCE_CATEGORIES) {
    items.push({
      id: `${cat.id}_header`,
      name: cat.name,
      keywords: cat.keywords,
      categoryId: 'technical_documents',
      defaultRequired: minYears > 0,
    });

    for (const fy of allYears) {
      const isSuggested = suggestedIds.has(fy.id);
      items.push({
        id: `${cat.id}_${fy.id}`,
        name: fy.label,
        keywords: [fy.label.toLowerCase(), cat.name.toLowerCase()],
        categoryId: 'technical_documents',
        defaultRequired: isSuggested,
        critical: isSuggested,
      });
    }
  }

  return items;
}

export function getSuggestedExperienceYears(
  masterParameters: EnterpriseMasterDatasetEntry[] | null
): FinancialYear[] {
  return suggestExperienceYears(parseMinimumExperienceYears(masterParameters));
}
