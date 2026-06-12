import { PageText } from '../../types/intelligence';
import { MasterDatasetKey } from '../../types/masterDataset';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { scoreSectionPriority } from './rankingRuleRegistry';

/** Page priority tiers for enterprise tender analysis. */
export type PagePriorityTier = 1 | 2 | 3 | 4;

export interface PagePriorityTierDefinition {
  tier: PagePriorityTier;
  label: string;
  pageRange: string;
  weight: number;
  description: string;
}

export const PAGE_PRIORITY_TIERS: PagePriorityTierDefinition[] = [
  {
    tier: 1,
    label: 'Tender Summary / NIT',
    pageRange: '1–5',
    weight: 100,
    description: 'Tender Summary, NIT, Tender Notice, Schedule Of Dates, Financial Summary, Bid Information',
  },
  {
    tier: 2,
    label: 'Requirements',
    pageRange: '6–20',
    weight: 70,
    description: 'Eligibility, Scope, Technical Requirements, Compliance Requirements',
  },
  {
    tier: 3,
    label: 'Detailed Clauses',
    pageRange: '21–50',
    weight: 40,
    description: 'Detailed Clauses, Terms & Conditions, Special Conditions',
  },
  {
    tier: 4,
    label: 'Annexures & Forms',
    pageRange: 'Any (content-based)',
    weight: 10,
    description: 'Annexures, Forms, Declarations, Formats, Bid Forms, Integrity Pact, Undertakings, Corrigendum',
  },
];

/** Core parameters that must prefer pages 1–5 over later pages. */
export const CORE_SUMMARY_PREFERRED_KEYS: MasterDatasetKey[] = [
  'tenderNumber',
  'nitNumber',
  'bidReferenceNumber',
  'organization',
  'department',
  'tenderTitle',
  'workName',
  'tenderValue',
  'estimatedCost',
  'emdAmount',
  'documentFee',
  'publishingDate',
  'bidStartDate',
  'bidEndDate',
  'technicalBidDate',
  'financialBidDate',
  'preBidMeetingDate',
  'completionPeriod',
  'contractPeriod',
  'scopeOfWork',
];

const LOW_PRIORITY_SECTION_RX =
  /\b(annexure|appendix|enclosure|declaration\s+form|undertaking|integrity\s+pact|bid\s+form|form\s+of\s+bid|specimen\s+format|sample\s+format|proforma|format\s+no\.?|table\s+of\s+contents|index\s+of|checklist|corrigendum|corrigenda|amendment\s+notice|addendum|revised\s+notice|extension\s+of\s+bid)\b/i;

export interface PagePriorityAnalysis {
  pagePriority: number;
  priorityTier: PagePriorityTier;
  sourceSection: string;
  isLowPrioritySection: boolean;
}

function basePriorityByPageNumber(pageNumber: number): { score: number; tier: PagePriorityTier } {
  if (pageNumber <= 5) return { score: 100, tier: 1 };
  if (pageNumber <= 20) return { score: 70, tier: 2 };
  if (pageNumber <= 50) return { score: 40, tier: 3 };
  return { score: 40, tier: 3 };
}

export function isLowPrioritySectionContent(text: string): boolean {
  return LOW_PRIORITY_SECTION_RX.test(String(text || '').slice(0, 6000));
}

export function resolvePagePriorityAnalysis(
  pageNumber: number,
  pageText = '',
  sourceText = ''
): PagePriorityAnalysis {
  const context = `${pageText}\n${sourceText}`.slice(0, 6000);
  const section = scoreSectionPriority(context);
  const sourceSection = section.section;

  if (isLowPrioritySectionContent(context) || section.score <= 20) {
    return {
      pagePriority: 10,
      priorityTier: 4,
      sourceSection,
      isLowPrioritySection: true,
    };
  }

  const base = basePriorityByPageNumber(pageNumber);
  return {
    pagePriority: base.score,
    priorityTier: base.tier,
    sourceSection,
    isLowPrioritySection: false,
  };
}

export function isCoreSummaryPreferredParameter(canonicalKey?: string, parameter?: string): boolean {
  if (canonicalKey && CORE_SUMMARY_PREFERRED_KEYS.includes(canonicalKey as MasterDatasetKey)) {
    return true;
  }
  const label = String(parameter || '').toLowerCase();
  return (
    /\b(tender\s+(?:no|number|value)|nit|organization|department|emd|earnest|document\s+fee|tender\s+fee|bid\s+(?:end|start|opening)|completion\s+period|contract\s+period|scope\s+of\s+work|estimated\s+cost)\b/i.test(
      label
    )
  );
}

/**
 * Score used in ranking — applies core-parameter bonus/penalty for summary pages.
 */
export function scorePagePriorityForCandidate(
  row: Pick<TenderParameterCandidateRow, 'page' | 'canonicalKey' | 'parameter' | 'sourceText'>,
  pageText = ''
): number {
  const analysis = resolvePagePriorityAnalysis(row.page, pageText, row.sourceText);
  let score = analysis.pagePriority;

  if (isCoreSummaryPreferredParameter(row.canonicalKey, row.parameter)) {
    if (row.page <= 5 && !analysis.isLowPrioritySection) {
      score = Math.min(100, score + 10);
    } else if (row.page > 5 || analysis.isLowPrioritySection) {
      score = Math.max(10, score - 30);
    }
  }

  return score;
}

export function compareCandidatesByPagePriority(
  a: Pick<TenderParameterCandidateRow, 'page' | 'pagePriority' | 'rankScore' | 'confidence' | 'canonicalKey' | 'parameter' | 'sourceText'>,
  b: Pick<TenderParameterCandidateRow, 'page' | 'pagePriority' | 'rankScore' | 'confidence' | 'canonicalKey' | 'parameter' | 'sourceText'>,
  pageMap?: Map<number, string>
): number {
  const prioA = a.pagePriority ?? scorePagePriorityForCandidate(a, pageMap?.get(a.page) || '');
  const prioB = b.pagePriority ?? scorePagePriorityForCandidate(b, pageMap?.get(b.page) || '');
  if (prioB !== prioA) return prioB - prioA;

  const rankA = a.rankScore ?? 0;
  const rankB = b.rankScore ?? 0;
  if (rankB !== rankA) return rankB - rankA;

  if (a.page !== b.page) return a.page - b.page;

  return (b.confidence ?? 0) - (a.confidence ?? 0);
}

export function buildPageTextMap(pages: PageText[]): Map<number, string> {
  return new Map(pages.map((p) => [p.pageNumber, p.text || '']));
}

export function enrichCandidatesWithPagePriority(
  candidates: TenderParameterCandidateRow[],
  pages: PageText[] = []
): TenderParameterCandidateRow[] {
  const pageMap = buildPageTextMap(pages);

  return candidates.map((row) => {
    const pageText = pageMap.get(row.page) || '';
    const analysis = resolvePagePriorityAnalysis(row.page, pageText, row.sourceText);
    return {
      ...row,
      pagePriority: scorePagePriorityForCandidate(row, pageText),
      priorityTier: analysis.priorityTier,
      sourceSection: analysis.sourceSection,
    };
  });
}

/** Order pages so high-priority summary pages are extracted first. */
export function orderPagesForPriorityExtraction(pages: PageText[]): PageText[] {
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const tier1 = sorted.filter((p) => p.pageNumber <= 5);
  const tier2 = sorted.filter((p) => p.pageNumber >= 6 && p.pageNumber <= 20);
  const tier3 = sorted.filter((p) => p.pageNumber >= 21 && p.pageNumber <= 50);
  const tier4 = sorted.filter((p) => p.pageNumber > 50);
  return [...tier1, ...tier2, ...tier3, ...tier4];
}

export function getEnterprisePagePriorityRuleSummary() {
  return {
    tiers: PAGE_PRIORITY_TIERS,
    coreSummaryPreferredParameters: CORE_SUMMARY_PREFERRED_KEYS,
    conflictResolution:
      'When the same parameter appears on multiple pages, prefer the value from the highest pagePriority (pages 1–5 first) unless validation rejects it.',
    storedMetadata: ['pageNumber', 'pagePriority', 'sourceSection'],
  };
}
