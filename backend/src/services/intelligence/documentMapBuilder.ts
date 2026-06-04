import { PageText } from '../../types/intelligence';

export type DocumentSectionType =
  | 'notice_inviting_tender'
  | 'eligibility'
  | 'financial'
  | 'scope_of_work'
  | 'bid_schedule'
  | 'annexure'
  | 'technical'
  | 'compliance'
  | 'general';

export interface DocumentSection {
  type: DocumentSectionType;
  title: string;
  startPage: number;
  endPage: number;
  confidence: number;
}

export interface DocumentMap {
  sections: DocumentSection[];
  /** Page number → section types active on that page */
  pageSections: Record<number, DocumentSectionType[]>;
  nitPages: number[];
  eligibilityPages: number[];
  financialPages: number[];
  scopePages: number[];
  bidSchedulePages: number[];
  annexurePages: number[];
  technicalPages: number[];
  compliancePages: number[];
  headingsByPage: Record<number, string[]>;
}

const SECTION_PATTERNS: Array<{
  type: DocumentSectionType;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    type: 'notice_inviting_tender',
    patterns: [
      /notice\s+inviting\s+tender/i,
      /\bnit\b/i,
      /invitation\s+for\s+(?:bid|tender)/i,
      /request\s+for\s+(?:proposal|quotation|tender)/i,
    ],
    weight: 1,
  },
  {
    type: 'eligibility',
    patterns: [
      /eligibility\s+criteria/i,
      /qualification\s+criteria/i,
      /pre-?qualification/i,
      /qualifying\s+requirements/i,
    ],
    weight: 0.95,
  },
  {
    type: 'financial',
    patterns: [
      /financial\s+(?:bid|criteria|requirement)/i,
      /earnest\s+money/i,
      /\bemd\b/i,
      /tender\s+fee/i,
      /performance\s+security/i,
      /bank\s+guarantee/i,
    ],
    weight: 0.9,
  },
  {
    type: 'scope_of_work',
    patterns: [
      /scope\s+of\s+(?:work|contract)/i,
      /nature\s+of\s+work/i,
      /description\s+of\s+(?:work|services)/i,
      /schedule\s+of\s+work/i,
    ],
    weight: 0.9,
  },
  {
    type: 'bid_schedule',
    patterns: [
      /important\s+dates/i,
      /bid\s+schedule/i,
      /date\s+schedule/i,
      /key\s+dates/i,
      /schedule\s+of\s+dates/i,
    ],
    weight: 0.85,
  },
  {
    type: 'annexure',
    patterns: [/annexure/i, /appendix/i, /enclosure/i, /form\s+no/i, /attachment/i],
    weight: 0.8,
  },
  {
    type: 'technical',
    patterns: [
      /technical\s+specification/i,
      /technical\s+requirement/i,
      /technical\s+bid/i,
      /specification\s+for/i,
    ],
    weight: 0.85,
  },
  {
    type: 'compliance',
    patterns: [
      /compliance\s+requirement/i,
      /statutory\s+requirement/i,
      /legal\s+requirement/i,
      /general\s+conditions/i,
      /special\s+conditions/i,
    ],
    weight: 0.8,
  },
];

function extractHeadings(pageText: string): string[] {
  const headings: string[] = [];
  const lines = pageText.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 6 && l.length <= 120);

  for (const line of lines) {
    if (/^(?:section|chapter|part)\s+[\divx]+/i.test(line)) headings.push(line);
    else if (/^[A-Z][A-Z0-9\s\-–—:()]{8,}$/.test(line) && !/shall|must|will/i.test(line)) {
      headings.push(line);
    } else if (/^(?:\d+\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,8}$/.test(line) && line.length < 80) {
      headings.push(line);
    }
  }
  return headings.slice(0, 12);
}

function scorePageForSection(page: PageText, type: DocumentSectionType): number {
  const sample = page.text.slice(0, 3500).toLowerCase();
  const def = SECTION_PATTERNS.find((s) => s.type === type);
  if (!def) return 0;
  let score = 0;
  for (const p of def.patterns) {
    if (p.test(sample)) score += def.weight;
  }
  return score;
}

export function emptyDocumentMap(): DocumentMap {
  return {
    sections: [],
    pageSections: {},
    headingsByPage: {},
    nitPages: [],
    eligibilityPages: [],
    financialPages: [],
    scopePages: [],
    bidSchedulePages: [],
    annexurePages: [],
    technicalPages: [],
    compliancePages: [],
  };
}

class DocumentMapBuilder {
  /**
   * Stage 2 — Document understanding: map sections before field extraction.
   */
  build(pages: PageText[]): DocumentMap {
    const pageSections: Record<number, DocumentSectionType[]> = {};
    const headingsByPage: Record<number, string[]> = {};
    const sectionStarts: Array<{ type: DocumentSectionType; page: number; title: string; score: number }> = [];

    for (const page of pages) {
      headingsByPage[page.pageNumber] = extractHeadings(page.text);
      const tags: DocumentSectionType[] = [];

      for (const { type } of SECTION_PATTERNS) {
        const s = scorePageForSection(page, type);
        if (s >= 0.85) tags.push(type);
      }

      if (!tags.length) tags.push('general');
      pageSections[page.pageNumber] = tags;

      const primary = tags[0];
      const heading = headingsByPage[page.pageNumber][0] || primary.replace(/_/g, ' ');
      sectionStarts.push({
        type: primary,
        page: page.pageNumber,
        title: heading,
        score: scorePageForSection(page, primary),
      });
    }

    const sections = this.mergeSectionRanges(sectionStarts, pages.length);
    const collect = (type: DocumentSectionType) =>
      Object.entries(pageSections)
        .filter(([, tags]) => tags.includes(type))
        .map(([p]) => Number(p));

    return {
      sections,
      pageSections,
      headingsByPage,
      nitPages: collect('notice_inviting_tender'),
      eligibilityPages: collect('eligibility'),
      financialPages: collect('financial'),
      scopePages: collect('scope_of_work'),
      bidSchedulePages: collect('bid_schedule'),
      annexurePages: collect('annexure'),
      technicalPages: collect('technical'),
      compliancePages: collect('compliance'),
    };
  }

  private mergeSectionRanges(
    starts: Array<{ type: DocumentSectionType; page: number; title: string; score: number }>,
    totalPages: number
  ): DocumentSection[] {
    if (!starts.length) {
      return [
        {
          type: 'general',
          title: 'Document',
          startPage: 1,
          endPage: Math.max(1, totalPages),
          confidence: 0.5,
        },
      ];
    }

    const merged: DocumentSection[] = [];
    let i = 0;
    while (i < starts.length) {
      const current = starts[i];
      let end = i + 1 < starts.length ? starts[i + 1].page - 1 : totalPages;
      if (end < current.page) end = current.page;

      merged.push({
        type: current.type,
        title: current.title,
        startPage: current.page,
        endPage: end,
        confidence: Math.min(0.99, 0.7 + current.score * 0.2),
      });
      i++;
    }

    return merged;
  }

  /** Pages to search first for a given field section. */
  pagesForFieldSection(
    map: DocumentMap,
    pages: PageText[],
    sectionHint: DocumentSectionType | DocumentSectionType[]
  ): PageText[] {
    const hints = Array.isArray(sectionHint) ? sectionHint : [sectionHint];
    const priority = new Set<number>();

    const lists: number[][] = [
      map.nitPages,
      map.eligibilityPages,
      map.financialPages,
      map.scopePages,
      map.bidSchedulePages,
      map.annexurePages,
      map.technicalPages,
      map.compliancePages,
    ];

    const typeToPages: Record<DocumentSectionType, number[]> = {
      notice_inviting_tender: map.nitPages,
      eligibility: map.eligibilityPages,
      financial: map.financialPages,
      scope_of_work: map.scopePages,
      bid_schedule: map.bidSchedulePages,
      annexure: map.annexurePages,
      technical: map.technicalPages,
      compliance: map.compliancePages,
      general: [],
    };

    for (const h of hints) {
      for (const p of typeToPages[h] || []) priority.add(p);
    }

    if (!priority.size) return pages;

    const prioritized = pages.filter((p) => priority.has(p.pageNumber));
    const rest = pages.filter((p) => !priority.has(p.pageNumber));
    return [...prioritized, ...rest];
  }

  /** Merge per-chunk document maps into one map for the full document. */
  mergeMaps(partials: DocumentMap[], totalPages: number): DocumentMap {
    if (!partials.length) return emptyDocumentMap();
    if (partials.length === 1) return partials[0];

    const pageSections: Record<number, DocumentSectionType[]> = {};
    const headingsByPage: Record<number, string[]> = {};

    for (const m of partials) {
      Object.assign(pageSections, m.pageSections);
      Object.assign(headingsByPage, m.headingsByPage);
    }

    const collect = (type: DocumentSectionType) =>
      Object.entries(pageSections)
        .filter(([, tags]) => tags.includes(type))
        .map(([p]) => Number(p))
        .sort((a, b) => a - b);

    const sectionStarts: Array<{ type: DocumentSectionType; page: number; title: string; score: number }> = [];
    for (const [pageStr, tags] of Object.entries(pageSections)) {
      const page = Number(pageStr);
      const primary = tags[0] || 'general';
      const heading = headingsByPage[page]?.[0] || primary.replace(/_/g, ' ');
      sectionStarts.push({
        type: primary,
        page,
        title: heading,
        score: 0.9,
      });
    }
    sectionStarts.sort((a, b) => a.page - b.page);

    return {
      sections: this.mergeSectionRanges(sectionStarts, totalPages),
      pageSections,
      headingsByPage,
      nitPages: collect('notice_inviting_tender'),
      eligibilityPages: collect('eligibility'),
      financialPages: collect('financial'),
      scopePages: collect('scope_of_work'),
      bidSchedulePages: collect('bid_schedule'),
      annexurePages: collect('annexure'),
      technicalPages: collect('technical'),
      compliancePages: collect('compliance'),
    };
  }
}

export const documentMapBuilder = new DocumentMapBuilder();
