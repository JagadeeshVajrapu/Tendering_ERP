import { PageText } from '../../types/intelligence';
import { TenderDocumentSectionType } from '../../types/tenderIntelligenceLayer';
import {
  EnterpriseSectionDefinition,
  ENTERPRISE_SECTION_KNOWLEDGE_BASE,
} from './enterpriseSectionDetectionKnowledgeBase';

export interface PageSectionHit {
  section: TenderDocumentSectionType;
  confidence: number;
  matchedKeywords: string[];
  matchedHeadings: string[];
}

export interface PageSectionClassification {
  page: number;
  sections: PageSectionHit[];
  primarySection: TenderDocumentSectionType;
  primaryConfidence: number;
}

export interface EnterpriseSectionDetectionResult {
  pageClassifications: PageSectionClassification[];
  documentSections: Array<{
    section: TenderDocumentSectionType;
    confidence: number;
    pages: number[];
    startPage?: number;
    endPage?: number;
    matchedKeywords: string[];
  }>;
  pagesScanned: number;
  detectedAt: string;
}

const MIN_SECTION_HIT_SCORE = 4;
const MIN_PAGE_SECTION_CONFIDENCE = 35;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countKeywordHits(text: string, keyword: string): number {
  const norm = normalizeText(text);
  const kw = normalizeText(keyword);
  if (!kw) return 0;

  if (kw.includes(' ')) {
    let count = 0;
    let idx = norm.indexOf(kw);
    while (idx !== -1) {
      count += 1;
      idx = norm.indexOf(kw, idx + kw.length);
    }
    return count;
  }

  const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return (norm.match(rx) || []).length;
}

function keywordWeight(keyword: string): number {
  const words = keyword.trim().split(/\s+/).length;
  if (words >= 3) return 5;
  if (words === 2) return 3;
  return 2;
}

function extractHeadings(pageText: string): string[] {
  const headings: string[] = [];
  const lines = pageText.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 4 && l.length <= 120);

  for (const line of lines) {
    if (/^(?:section|chapter|part|schedule)\s+[\divxlc\d]+/i.test(line)) headings.push(line);
    else if (/^[A-Z][A-Z0-9\s\-–—:()]{6,}$/.test(line) && !/shall|must|will/i.test(line)) {
      headings.push(line);
    } else if (/^(?:\d+\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,6}$/.test(line) && line.length < 80) {
      headings.push(line);
    }
  }
  return headings.slice(0, 15);
}

function scorePageForSection(
  pageText: string,
  headings: string[],
  def: EnterpriseSectionDefinition,
  pageNumber: number
): { score: number; keywords: string[]; matchedHeadings: string[] } {
  const sample = pageText.slice(0, 5000);
  let score = 0;
  const keywords: string[] = [];
  const matchedHeadings: string[] = [];

  for (const keyword of def.keywords) {
    const hits = countKeywordHits(sample, keyword);
    if (hits > 0) {
      score += hits * keywordWeight(keyword);
      keywords.push(keyword);
    }
  }

  for (const pattern of def.headingPatterns) {
    if (pattern.test(sample)) score += 8;
    for (const h of headings) {
      if (pattern.test(h)) {
        score += 10;
        matchedHeadings.push(h);
      }
    }
  }

  for (const pattern of def.tableTitlePatterns) {
    if (pattern.test(sample)) score += 6;
  }

  // Page context boost for summary sections on early pages
  if (pageNumber <= 5 && ['Identity', 'Financial', 'Timeline'].includes(def.section)) {
    score += 6;
  }
  if (pageNumber <= 20 && ['Eligibility', 'Scope', 'Compliance'].includes(def.section)) {
    score += 3;
  }

  return { score, keywords, matchedHeadings };
}

function scoreToConfidence(score: number, pageNumber: number, section: TenderDocumentSectionType): number {
  let confidence = Math.min(99, Math.max(MIN_PAGE_SECTION_CONFIDENCE, Math.round(40 + score * 2.5)));
  if (section === 'Annexures' && pageNumber <= 5) {
    confidence = Math.max(MIN_PAGE_SECTION_CONFIDENCE, confidence - 15);
  }
  return confidence;
}

export function classifyPageSections(page: PageText): PageSectionClassification {
  const text = page.text || '';
  const headings = extractHeadings(text);
  const hits: PageSectionHit[] = [];

  for (const def of ENTERPRISE_SECTION_KNOWLEDGE_BASE) {
    const { score, keywords, matchedHeadings } = scorePageForSection(
      text,
      headings,
      def,
      page.pageNumber
    );
    if (score < MIN_SECTION_HIT_SCORE) continue;

    hits.push({
      section: def.section,
      confidence: scoreToConfidence(score, page.pageNumber, def.section),
      matchedKeywords: keywords.slice(0, 8),
      matchedHeadings: matchedHeadings.slice(0, 4),
    });
  }

  hits.sort((a, b) => b.confidence - a.confidence);

  if (!hits.length) {
    const fallback: TenderDocumentSectionType =
      page.pageNumber <= 5 ? 'Identity' : page.pageNumber <= 20 ? 'Eligibility' : 'Scope';
    return {
      page: page.pageNumber,
      sections: [{ section: fallback, confidence: 45, matchedKeywords: [], matchedHeadings: [] }],
      primarySection: fallback,
      primaryConfidence: 45,
    };
  }

  return {
    page: page.pageNumber,
    sections: hits,
    primarySection: hits[0].section,
    primaryConfidence: hits[0].confidence,
  };
}

export function detectEnterpriseDocumentSections(pages: PageText[]): EnterpriseSectionDetectionResult {
  const pageClassifications = pages.map(classifyPageSections);

  const sectionAgg = new Map<
    TenderDocumentSectionType,
    { score: number; pages: Set<number>; keywords: Set<string> }
  >();

  for (const def of ENTERPRISE_SECTION_KNOWLEDGE_BASE) {
    sectionAgg.set(def.section, { score: 0, pages: new Set(), keywords: new Set() });
  }

  for (const pc of pageClassifications) {
    for (const hit of pc.sections) {
      const bucket = sectionAgg.get(hit.section)!;
      bucket.score += hit.confidence;
      bucket.pages.add(pc.page);
      for (const kw of hit.matchedKeywords) bucket.keywords.add(kw);
    }
  }

  const documentSections = ENTERPRISE_SECTION_KNOWLEDGE_BASE.map((def) => {
    const bucket = sectionAgg.get(def.section)!;
    const pageList = Array.from(bucket.pages).sort((a, b) => a - b);
    if (!pageList.length) return null;

    return {
      section: def.section,
      confidence: Math.min(99, Math.round(bucket.score / pageList.length)),
      pages: pageList,
      startPage: pageList[0],
      endPage: pageList[pageList.length - 1],
      matchedKeywords: Array.from(bucket.keywords).slice(0, 12),
    };
  }).filter(Boolean) as EnterpriseSectionDetectionResult['documentSections'];

  return {
    pageClassifications,
    documentSections,
    pagesScanned: pages.length,
    detectedAt: new Date().toISOString(),
  };
}

export function buildSectionExtractionContext(result: EnterpriseSectionDetectionResult): string {
  const lines = result.pageClassifications
    .filter((p) => p.sections.length)
    .slice(0, 40)
    .map((p) => {
      const tags = p.sections.map((s) => `${s.section}(${s.confidence}%)`).join(', ');
      return `Page ${p.page}: ${tags}`;
    });

  const summary = result.documentSections
    .map((s) => `- ${s.section}: pages ${s.startPage}-${s.endPage} (${s.confidence}% confidence)`)
    .join('\n');

  return `ENTERPRISE SECTION DETECTION (extract parameters only from matching sections):
Document Sections:
${summary || '- No high-confidence sections detected'}

Per-Page Sections:
${lines.join('\n') || '- No per-page classification'}

EXTRACTION RULES:
- Identity parameters → Identity section only (fallback: Financial, Timeline)
- Financial parameters → Financial section only (fallback: Identity, Timeline)
- Timeline parameters → Timeline section only (fallback: Financial, Identity)
- Compliance parameters → Compliance section only (fallback: Eligibility)
- Scope parameters → Scope section only (fallback: Technical Specifications)
- Never prefer Annexures over NIT/summary sections for core parameters.`;
}

export function pageHasSection(
  pageClassifications: PageSectionClassification[],
  page: number,
  section: TenderDocumentSectionType,
  minConfidence = MIN_PAGE_SECTION_CONFIDENCE
): boolean {
  const pc = pageClassifications.find((p) => p.page === page);
  if (!pc) return false;
  return pc.sections.some((s) => s.section === section && s.confidence >= minConfidence);
}

export function isPagePrimarilyAnnexure(
  pageClassifications: PageSectionClassification[],
  page: number
): boolean {
  const pc = pageClassifications.find((p) => p.page === page);
  if (!pc) return false;
  const annexure = pc.sections.find((s) => s.section === 'Annexures');
  return !!annexure && (pc.primarySection === 'Annexures' || annexure.confidence >= pc.primaryConfidence);
}

export function getEnterpriseSectionDetectionRuleSummary() {
  return {
    supportedSections: ENTERPRISE_SECTION_KNOWLEDGE_BASE.map((s) => s.section),
    detectionSignals: ['Keywords', 'Headings', 'Table Titles', 'Document Structure', 'Page Context'],
    multiSectionSupport: true,
    storedMetadata: ['pageNumber', 'sectionName', 'sectionConfidence'],
    annexurePolicy: 'Never search Annexures first for core parameters',
  };
}
