import {
  RankingContextLabelRule,
  RankingSectionRule,
  RankingSpecialRule,
} from '../../types/enterpriseTenderCandidateRanking';
import { MasterDatasetKey } from '../../types/masterDataset';

/**
 * Data-driven ranking rules — extend without engine code changes.
 */

export const RANKING_SECTION_RULES: RankingSectionRule[] = [
  { id: 'nit', label: 'Notice Inviting Tender', score: 100, patterns: [/\b(notice\s+inviting\s+tender|invitation\s+for\s+bid|\bnit\b|tender\s+notice)\b/i] },
  { id: 'summary', label: 'Tender Summary', score: 90, patterns: [/\b(tender\s+summary|key\s+details|salient\s+features|at\s+a\s+glance|brief\s+summary)\b/i] },
  { id: 'dates', label: 'Important Dates', score: 85, patterns: [/\b(important\s+dates?|bid\s+schedule|tender\s+schedule|schedule\s+of\s+bid)\b/i] },
  { id: 'eligibility', label: 'Eligibility Criteria', score: 80, patterns: [/\b(eligibility\s+criteria|qualification\s+criteria|pre\s*qualification)\b/i] },
  { id: 'financial', label: 'Financial Conditions', score: 80, patterns: [/\b(financial\s+conditions?|financial\s+bid|price\s+bid|commercial\s+bid)\b/i] },
  { id: 'scope', label: 'Scope Of Work', score: 75, patterns: [/\b(scope\s+of\s+work|technical\s+specifications?|statement\s+of\s+work)\b/i] },
  { id: 'particulars', label: 'Tender Particulars', score: 70, patterns: [/\b(particulars|tender\s+details|tender\s+particulars)\b/i] },
  { id: 'annexure', label: 'Annexure', score: 20, patterns: [/\b(annexure|appendix|schedule\s+[a-z]\s*[-–]?\s*annex)\b/i] },
  { id: 'declaration', label: 'Declaration', score: 15, patterns: [/\b(declaration\s+form|self[\s-]?declaration|undertaking\s+form|specimen\s+format)\b/i] },
  { id: 'integrity', label: 'Integrity Pact', score: 10, patterns: [/\b(integrity\s+pact|draft\s+format|form\s+of\s+bid)\b/i] },
];

export const RANKING_CONTEXT_LABEL_RULES: RankingContextLabelRule[] = [
  {
    parameterKeys: ['tenderValue', 'estimatedCost'],
    labels: ['tender value', 'estimated cost', 'project cost', 'contract value', 'work value', 'estimated tender value'],
  },
  {
    parameterKeys: ['emdAmount'],
    labels: ['emd', 'earnest money', 'bid security', 'earnest money deposit', 'emd amount'],
  },
  {
    parameterKeys: ['documentFee'],
    labels: ['tender fee', 'document fee', 'bid fee', 'processing fee'],
  },
  {
    parameterKeys: ['bidEndDate'],
    labels: ['bid end', 'last date of submission', 'submission deadline', 'closing date', 'bid closing'],
  },
  {
    parameterKeys: ['bidStartDate'],
    labels: ['bid start', 'submission start', 'tender start'],
  },
  {
    parameterKeys: ['technicalBidDate'],
    labels: ['technical opening', 'technical bid opening', 'tech bid opening'],
  },
  {
    parameterKeys: ['financialBidDate'],
    labels: ['financial opening', 'financial bid opening', 'price bid opening', 'commercial bid opening'],
  },
  {
    parameterKeys: ['turnoverRequirement'],
    labels: ['turnover', 'annual turnover', 'minimum turnover', 'average annual turnover'],
  },
  {
    parameterKeys: ['experienceRequirement'],
    labels: ['experience', 'similar work', 'past experience', 'work experience', 'relevant experience'],
  },
  {
    parameterKeys: ['scopeOfWork'],
    labels: ['scope of work', 'work scope', 'nature of work'],
  },
  {
    parameterKeys: ['performanceSecurity'],
    labels: ['performance security', 'performance guarantee', 'pbg', 'performance bank guarantee'],
  },
];

export const RANKING_SPECIAL_RULES: RankingSpecialRule[] = [
  {
    parameterKeys: ['tenderValue', 'estimatedCost'],
    forbiddenContextPatterns: [
      /\bturnover\b/i,
      /\bannual\s+turnover\b/i,
      /\bexperience\b/i,
      /\bsimilar\s+work\b/i,
      /\bbank\s*solvency\b/i,
      /\bsolvency\s+certificate\b/i,
    ],
    allowedContextPatterns: [
      /\btender\s*value\b/i,
      /\bestimated\s*cost\b/i,
      /\bproject\s*cost\b/i,
      /\bcontract\s*value\b/i,
      /\bwork\s*value\b/i,
      /\bestimated\s*tender\s*value\b/i,
      /\bvalue\s*of\s*work\b/i,
    ],
    rejectReason: 'wrong_context_not_tender_value',
    description: 'Tender Value — reject turnover, experience, or bank solvency amounts',
  },
  {
    parameterKeys: ['emdAmount'],
    forbiddenContextPatterns: [
      /\bperformance\s*(guarantee|security|bond)\b/i,
      /\bpbg\b/i,
      /\bperformance\s+bank\s+guarantee\b/i,
    ],
    allowedContextPatterns: [
      /\bemd\b/i,
      /\bearnest\s*money\b/i,
      /\bbid\s*security\b/i,
      /\bearnest\s*money\s*deposit\b/i,
    ],
    rejectReason: 'wrong_context_not_emd',
    description: 'EMD — reject performance guarantee / PBG context',
  },
  {
    parameterKeys: ['bidEndDate'],
    forbiddenContextPatterns: [
      /\bpre[\s-]?bid\b/i,
      /\bopening\s+date\b/i,
      /\btechnical\s+opening\b/i,
      /\bfinancial\s+opening\b/i,
      /\bcontract\s+(date|period)\b/i,
      /\bpublishing\s+date\b/i,
    ],
    allowedContextPatterns: [
      /\bbid\s*end\b/i,
      /\blast\s+date\s+of\s+submission\b/i,
      /\bsubmission\s+deadline\b/i,
      /\bclosing\s+date\b/i,
      /\bbid\s+closing\b/i,
    ],
    rejectReason: 'wrong_context_not_bid_end_date',
    description: 'Bid End Date — reject pre-bid, opening, or contract dates',
  },
];

const LOW_PRIORITY_SECTION_RX =
  /\b(annexure|appendix|declaration\s+form|integrity\s+pact|checklist|table\s+of\s+contents|index\s+of|header|footer|page\s+number)\b/i;

export function getContextLabelsForKey(key?: string): string[] {
  if (!key) return [];
  const rule = RANKING_CONTEXT_LABEL_RULES.find((r) => r.parameterKeys.includes(key as MasterDatasetKey));
  return rule?.labels ?? [];
}

export function scoreSectionPriority(context: string): { score: number; section: string } {
  const lower = context.toLowerCase();
  let best = { score: 40, section: 'general' };
  for (const rule of RANKING_SECTION_RULES) {
    if (rule.patterns.some((p) => p.test(lower))) {
      if (rule.score > best.score) best = { score: rule.score, section: rule.label };
    }
  }
  if (LOW_PRIORITY_SECTION_RX.test(lower) && best.score > 25) {
    return { score: 20, section: 'low_priority_section' };
  }
  return best;
}

export function detectSpecialRuleViolation(
  canonicalKey: string | undefined,
  context: string,
  sourceText: string
): string | null {
  if (!canonicalKey) return null;
  const text = `${context}\n${sourceText}`;
  for (const rule of RANKING_SPECIAL_RULES) {
    if (!rule.parameterKeys.includes(canonicalKey as MasterDatasetKey)) continue;
    const hasForbidden = rule.forbiddenContextPatterns.some((p) => p.test(text));
    if (!hasForbidden) continue;
    const hasAllowed = rule.allowedContextPatterns?.some((p) => p.test(text)) ?? false;
    if (!hasAllowed) return rule.rejectReason;
  }
  return null;
}
