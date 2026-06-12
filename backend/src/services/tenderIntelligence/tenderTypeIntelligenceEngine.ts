import { PageText } from '../../types/intelligence';
import {
  TenderTypeIntelligenceResult,
  TenderTypeProfile,
} from '../../types/tenderTypeIntelligence';
import {
  getTenderTypeProfile,
  TENDER_TYPE_PROFILE_KNOWLEDGE_BASE,
} from './tenderTypeIntelligenceKnowledgeBase';
import {
  buildTenderTypeLibraryContext,
  formatTenderTypeLibraryAliasHints,
  loadTenderTypeLibrary,
} from './enterpriseTenderTypeLibraryEngine';

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

function countPatternHits(text: string, patterns: RegExp[] = []): number {
  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) hits += 3;
  }
  return hits;
}

export function detectTenderTypeFromText(fullText: string): {
  tenderType: string;
  confidence: number;
  typeScores: Record<string, number>;
  matchedKeywords: string[];
} {
  const typeScores: Record<string, number> = {};
  const matchedByType = new Map<string, Set<string>>();

  for (const def of TENDER_TYPE_PROFILE_KNOWLEDGE_BASE) {
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
    tenderType: topType,
    confidence,
    typeScores,
    matchedKeywords: Array.from(matchedByType.get(topType) || []),
  };
}

export function detectTenderTypeFromPages(pages: PageText[]) {
  const fullText = pages.map((p) => p.text || '').join('\n');
  return detectTenderTypeFromText(fullText);
}

export function formatAliasHints(profile: TenderTypeProfile): string {
  const library = loadTenderTypeLibrary(profile.tenderType || '');
  const libraryHints = formatTenderTypeLibraryAliasHints(library);
  if (!profile.aliases.length) return libraryHints;
  const lines = profile.aliases.map(
    (a) => `- OCR labels [${a.from.join(' | ')}] → canonical "${a.to}"`
  );
  const base = `TENDER-TYPE ALIAS HINTS (${profile.tenderType || 'General'}):\n${lines.join('\n')}`;
  return libraryHints ? `${base}\n\n${libraryHints}` : base;
}

export function buildTenderTypeExtractionContext(
  tenderType: string,
  confidence: number,
  profile: TenderTypeProfile
): string {
  const paramList = profile.parameters.length
    ? profile.parameters.map((p) => `- ${p}`).join('\n')
    : '- (use general tender parameters)';

  const ruleList = profile.rules.length
    ? profile.rules.map((r) => `- ${r}`).join('\n')
    : '- Apply standard government tender extraction rules.';

  const aliasLines = profile.aliases.length
    ? profile.aliases
        .map((a) => `- ${a.from.slice(0, 3).join(' / ')} → ${a.to}`)
        .join('\n')
    : '- No type-specific alias overrides.';

  return `TENDER-TYPE INTELLIGENCE ENGINE
Detected Tender Type: ${tenderType || 'Unclassified'} (${confidence}% confidence)

TENDER-SPECIFIC PARAMETERS (prioritize these when present in OCR):
${paramList}

TENDER-SPECIFIC RULES:
${ruleList}

TENDER-SPECIFIC ALIASES:
${aliasLines}

Adapt extraction to this tender type. Prefer type-specific parameters over generic clause text.`;
}

export function analyzeTenderTypeIntelligence(pages: PageText[]): TenderTypeIntelligenceResult {
  const detection = detectTenderTypeFromPages(pages);
  const profile = getTenderTypeProfile(detection.tenderType);
  const library = loadTenderTypeLibrary(detection.tenderType);
  const libraryContext = buildTenderTypeLibraryContext(detection.tenderType, detection.confidence);
  const extractionContext = `${buildTenderTypeExtractionContext(
    detection.tenderType,
    detection.confidence,
    profile
  )}\n\n${libraryContext}`;
  const aliasHintsText = formatAliasHints(profile);

  return {
    tenderType: (detection.tenderType || '') as TenderTypeIntelligenceResult['tenderType'],
    confidence: detection.confidence,
    typeScores: detection.typeScores,
    matchedKeywords: detection.matchedKeywords,
    profile,
    library,
    extractionContext,
    libraryContext,
    aliasHintsText,
  };
}

export function getTenderTypeIntelligenceRuleSummary() {
  return {
    engine: 'tender_type_intelligence',
    detectableTypes: TENDER_TYPE_PROFILE_KNOWLEDGE_BASE.map((d) => d.type),
    outputs: ['tenderType', 'confidence', 'parameters', 'rules', 'aliases', 'extractionContext'],
    policy: 'Extraction adapts automatically based on detected tender type.',
  };
}
