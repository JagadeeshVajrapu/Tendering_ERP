import { FieldSection } from './fieldDefinitions';
import { PageText } from '../../types/intelligence';

export type PageContextTag =
  | 'annexure'
  | 'appendix'
  | 'schedule'
  | 'table'
  | 'eligibility'
  | 'financial'
  | 'technical'
  | 'timeline'
  | 'main';

const ANNEXURE_MARKERS = [
  'annexure',
  'annex',
  'appendix',
  'enclosure',
  'attachment',
  'form no',
  'form no.',
  'schedule of',
  'appendix',
];

const SCHEDULE_MARKERS = ['schedule', 'sl.no', 'sr.no', 's.no', 'particulars'];

const TABLE_MARKERS = ['table', 'particulars', 'description', 'amount', 'remarks'];

const SECTION_MARKERS: Record<Exclude<PageContextTag, 'main' | 'annexure' | 'appendix' | 'schedule' | 'table'>, string[]> = {
  eligibility: [
    'eligibility',
    'qualification',
    'pre-qualification',
    'prequalification',
    'qualifying criteria',
    'bidder should have',
  ],
  financial: [
    'financial',
    'emd',
    'earnest money',
    'tender fee',
    'turnover',
    'bid security',
    'performance security',
    'bank guarantee',
  ],
  technical: [
    'technical specification',
    'technical requirement',
    'scope of work',
    'schedule of work',
    'specification',
  ],
  timeline: [
    'important dates',
    'date schedule',
    'key dates',
    'bid submission',
    'last date',
    'opening date',
  ],
};

export function classifyPageTags(page: PageText): PageContextTag[] {
  const lower = page.text.toLowerCase().slice(0, 2500);
  const tags = new Set<PageContextTag>();

  if (ANNEXURE_MARKERS.some((m) => lower.includes(m))) {
    tags.add('annexure');
    tags.add('appendix');
  }
  if (SCHEDULE_MARKERS.some((m) => lower.includes(m))) tags.add('schedule');
  if (TABLE_MARKERS.some((m) => lower.includes(m))) tags.add('table');

  for (const [section, markers] of Object.entries(SECTION_MARKERS)) {
    if (markers.some((m) => lower.includes(m))) {
      tags.add(section as PageContextTag);
    }
  }

  if (!tags.size) tags.add('main');
  return [...tags];
}

export function pageMatchesSection(tags: PageContextTag[], section: FieldSection): boolean {
  const map: Partial<Record<FieldSection, PageContextTag[]>> = {
    general: ['main', 'annexure', 'schedule'],
    financial: ['financial', 'table', 'annexure', 'main'],
    timeline: ['timeline', 'table', 'annexure', 'main'],
    eligibility: ['eligibility', 'table', 'annexure', 'technical'],
    documents: ['annexure', 'appendix', 'schedule', 'table'],
    technical: ['technical', 'table', 'annexure', 'schedule'],
    compliance: ['eligibility', 'financial', 'annexure'],
    risk: ['main', 'annexure'],
  };
  const wanted = map[section] || ['main'];
  return tags.some((t) => wanted.includes(t));
}

export function scorePageForField(
  page: PageText,
  pageHints: string[],
  section: FieldSection,
  recoveryPass?: boolean
): number {
  const lower = page.text.toLowerCase();
  const tags = classifyPageTags(page);
  let score = 0;

  for (const h of pageHints) {
    if (lower.includes(h.toLowerCase())) score += 4;
  }
  if (pageMatchesSection(tags, section)) score += 5;
  if (tags.includes('annexure') || tags.includes('appendix')) score += recoveryPass ? 6 : 3;
  if (tags.includes('table')) score += 4;
  if (tags.includes('schedule')) score += 2;

  return score;
}

export function filterPagesByContext(
  pages: PageText[],
  filter: 'annexure' | 'section' | 'table' | 'all',
  section: FieldSection
): PageText[] {
  if (filter === 'all') return pages;

  return pages.filter((p) => {
    const tags = classifyPageTags(p);
    if (filter === 'annexure') {
      return tags.includes('annexure') || tags.includes('appendix') || tags.includes('schedule');
    }
    if (filter === 'table') {
      return tags.includes('table') || tags.includes('schedule');
    }
    return pageMatchesSection(tags, section);
  });
}

export function neighborPages(pages: PageText[], pageNumber: number, radius = 1): PageText[] {
  return pages.filter((p) => Math.abs(p.pageNumber - pageNumber) <= radius);
}
