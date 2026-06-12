import { PageText } from '../../types/intelligence';
import {
  TenderDocumentSection,
  TenderIntelligenceLayerResult,
  TenderIntelligenceType,
} from '../../types/tenderIntelligenceLayer';
import {
  DOCUMENT_SECTION_KNOWLEDGE_BASE,
  TENDER_TYPE_KNOWLEDGE_BASE,
} from './tenderIntelligenceKnowledgeBase';

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

function countPatternHits(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) hits += 3;
  }
  return hits;
}

export function detectTenderType(fullText: string): {
  tenderType: TenderIntelligenceType | '';
  confidence: number;
  typeScores: Record<string, number>;
  matchedKeywords: string[];
} {
  const typeScores: Record<string, number> = {};
  const matchedByType = new Map<string, Set<string>>();

  for (const def of TENDER_TYPE_KNOWLEDGE_BASE) {
    let score = 0;
    const matched = new Set<string>();

    for (const keyword of def.keywords) {
      const hits = countKeywordHits(fullText, keyword);
      if (hits > 0) {
        score += hits * keywordWeight(keyword);
        matched.add(keyword);
      }
    }

    if (def.headingPatterns?.length) {
      score += countPatternHits(fullText, def.headingPatterns);
    }

    typeScores[def.type] = score;
    matchedByType.set(def.type, matched);
  }

  const ranked = Object.entries(typeScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    return { tenderType: '', confidence: 0, typeScores, matchedKeywords: [] };
  }

  const [topType, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const margin = topScore - secondScore;
  const confidence = Math.min(99, Math.max(35, Math.round(50 + margin * 3 + Math.min(topScore, 25))));

  return {
    tenderType: topType as TenderIntelligenceType,
    confidence,
    typeScores,
    matchedKeywords: Array.from(matchedByType.get(topType) || []),
  };
}

export function detectDocumentSections(pages: PageText[]): TenderDocumentSection[] {
  const sectionHits = new Map<
    string,
    { score: number; pages: Set<number>; keywords: Set<string> }
  >();

  for (const def of DOCUMENT_SECTION_KNOWLEDGE_BASE) {
    sectionHits.set(def.section, { score: 0, pages: new Set(), keywords: new Set() });
  }

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;

    for (const def of DOCUMENT_SECTION_KNOWLEDGE_BASE) {
      const bucket = sectionHits.get(def.section)!;
      let pageScore = 0;

      for (const keyword of def.keywords) {
        const hits = countKeywordHits(text, keyword);
        if (hits > 0) {
          pageScore += hits * keywordWeight(keyword);
          bucket.keywords.add(keyword);
        }
      }

      pageScore += countPatternHits(text, def.headingPatterns);
      if (pageScore > 0) {
        bucket.score += pageScore;
        bucket.pages.add(page.pageNumber);
      }
    }
  }

  const sections: TenderDocumentSection[] = [];

  for (const def of DOCUMENT_SECTION_KNOWLEDGE_BASE) {
    const bucket = sectionHits.get(def.section)!;
    if (bucket.score < 3) continue;

    const pageList = Array.from(bucket.pages).sort((a, b) => a - b);
    const confidence = Math.min(99, Math.max(40, Math.round(45 + bucket.score * 2)));

    sections.push({
      section: def.section,
      confidence,
      pages: pageList,
      startPage: pageList[0],
      endPage: pageList[pageList.length - 1],
      matchedKeywords: Array.from(bucket.keywords).slice(0, 12),
    });
  }

  return sections.sort((a, b) => (a.startPage ?? 0) - (b.startPage ?? 0));
}

export function analyzeTenderIntelligence(pages: PageText[]): TenderIntelligenceLayerResult & {
  typeScores: Record<string, number>;
} {
  const fullText = pages.map((p) => p.text || '').join('\n');
  const typeResult = detectTenderType(fullText);
  const sections = detectDocumentSections(pages);

  return {
    tenderType: typeResult.tenderType,
    confidence: typeResult.confidence,
    sections,
    typeScores: typeResult.typeScores,
  };
}

export function buildIntelligenceExtractionContext(result: TenderIntelligenceLayerResult): string {
  const sectionLines =
    result.sections.length > 0
      ? result.sections
          .map(
            (s) =>
              `- ${s.section}: pages ${s.startPage ?? '?'}-${s.endPage ?? '?'} (${s.confidence}% confidence)`
          )
          .join('\n')
      : '- No sections detected with high confidence';

  return `TENDER INTELLIGENCE LAYER (pre-extraction analysis):
Tender Type: ${result.tenderType || 'Unclassified'} (${result.confidence}% confidence)
Detected Document Sections:
${sectionLines}

Use tender type and section context to prioritize parameter extraction.
Map each extracted parameter category to the most relevant detected section.`;
}
