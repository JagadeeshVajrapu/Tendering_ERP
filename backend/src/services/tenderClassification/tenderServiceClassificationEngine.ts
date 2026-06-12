import { PageText } from '../../types/intelligence';
import { TenderServiceClassificationResult } from '../../types/tenderServiceClassification';
import { SERVICE_CLASSIFICATION_KNOWLEDGE_BASE } from './serviceClassificationKnowledgeBase';

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

export function classifyTenderServiceFromText(fullText: string): TenderServiceClassificationResult {
  const categoryScores: Record<string, number> = {};
  const matchedByCategory = new Map<string, Set<string>>();

  for (const def of SERVICE_CLASSIFICATION_KNOWLEDGE_BASE) {
    let score = 0;
    const matched = new Set<string>();

    for (const keyword of def.keywords) {
      const hits = countKeywordHits(fullText, keyword);
      if (hits > 0) {
        score += hits * keywordWeight(keyword);
        matched.add(keyword);
      }
    }

    categoryScores[def.category] = score;
    matchedByCategory.set(def.category, matched);
  }

  const ranked = Object.entries(categoryScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!ranked.length) {
    return {
      serviceCategory: '',
      confidence: 0,
      matchedKeywords: [],
      categoryScores,
    };
  }

  const [topCategory, topScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const margin = topScore - secondScore;
  const confidence = Math.min(99, Math.max(40, Math.round(55 + margin * 4 + Math.min(topScore, 20))));

  return {
    serviceCategory: topCategory as TenderServiceClassificationResult['serviceCategory'],
    confidence,
    matchedKeywords: Array.from(matchedByCategory.get(topCategory) || []),
    categoryScores,
  };
}

export function classifyTenderServiceFromPages(pages: PageText[]): TenderServiceClassificationResult {
  const fullText = pages.map((p) => p.text || '').join('\n');
  return classifyTenderServiceFromText(fullText);
}
