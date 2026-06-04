import { PageText } from '../../types/intelligence';
import { ProductionFieldDefinition } from './fieldDefinitions';
import { FieldCandidate } from './fieldLevelExtractor';
import { DocumentMap } from './documentMapBuilder';
import { scorePageForField } from './documentPageContext';
import { applyFieldRanker } from './fieldRankers';

export interface CandidateRankBreakdown {
  headingMatch: number;
  contextMatch: number;
  tableMatch: number;
  pageRelevance: number;
  keywordMatch: number;
  fieldRankBonus: number;
  total: number;
}

const FIELD_SECTION_TO_DOC: Record<string, string[]> = {
  general: ['notice_inviting_tender', 'general'],
  financial: ['financial', 'notice_inviting_tender'],
  timeline: ['bid_schedule', 'notice_inviting_tender'],
  eligibility: ['eligibility', 'annexure'],
  documents: ['annexure', 'compliance'],
  technical: ['technical', 'annexure'],
  compliance: ['compliance', 'eligibility'],
  risk: ['compliance', 'general'],
};

/**
 * Step 3 — Score candidates (heading, context, table, page relevance, keyword).
 * No value is selected here — ranking only.
 */
export function scoreCandidate(
  candidate: FieldCandidate,
  def: ProductionFieldDefinition,
  page: PageText,
  documentMap: DocumentMap,
  contextScores: {
    contextScore: number;
    headingScore: number;
    formatScore: number;
    sectionScore: number;
    sectionHint: string;
    sourceText: string;
  }
): CandidateRankBreakdown {
  const headingMatch = Math.min(25, (contextScores.headingScore / 0.15) * 25 || 0);
  const contextMatch = Math.min(30, contextScores.contextScore * 30);
  const tableMatch = candidate.source === 'table' ? 20 : candidate.source === 'label' ? 8 : 5;
  const pageRelevance = Math.min(
    20,
    (scorePageForField(page, def.pageHints, def.section, false) / 15) * 20
  );

  let keywordMatch = 0;
  const lower = contextScores.sourceText.toLowerCase();
  for (const label of [...def.labels, ...(def.synonymLabels || [])]) {
    if (lower.includes(label.toLowerCase())) {
      keywordMatch = Math.max(keywordMatch, 15);
      break;
    }
  }
  if (def.patterns.some((p) => p.test(contextScores.sourceText))) {
    keywordMatch = Math.max(keywordMatch, 12);
  }

  const ranker = applyFieldRanker(def, candidate, contextScores.sourceText);
  const fieldRankBonus = ranker.reject ? 0 : Math.min(15, ranker.rankBonus / 5);

  const hints = FIELD_SECTION_TO_DOC[def.section] || ['general'];
  const onRightSection = hints.some((h) =>
    (documentMap.pageSections[page.pageNumber] || []).includes(h as never)
  );
  const sectionBoost = onRightSection ? 5 : 0;

  const total = Math.min(
    99,
    Math.round(
      headingMatch +
        contextMatch +
        tableMatch +
        pageRelevance +
        keywordMatch +
        fieldRankBonus +
        sectionBoost
    )
  );

  return {
    headingMatch,
    contextMatch,
    tableMatch,
    pageRelevance,
    keywordMatch,
    fieldRankBonus,
    total,
  };
}
