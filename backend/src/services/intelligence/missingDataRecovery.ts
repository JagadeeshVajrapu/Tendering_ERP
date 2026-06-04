import {
  ExtractedField,
  IntelligenceFieldKey,
  PageText,
} from '../../types/intelligence';
import { MANDATORY_FIELDS } from './fields';
import { localIntelligenceExtractor } from './localIntelligenceExtractor';

const ANNEXURE_KEYWORDS = [
  'annexure',
  'annex',
  'appendix',
  'schedule',
  'table',
  'form',
  'enclosure',
  'attachment',
];

const FIELD_SEARCH: Partial<
  Record<
    IntelligenceFieldKey,
    { labels: string[]; patterns?: RegExp[]; pageHints?: string[] }
  >
> = {
  tenderName: {
    labels: ['name of work', 'name of tender', 'tender for', 'title'],
    patterns: [
      /(?:name of (?:work|tender)|tender for)[:\s]+([^\n]{5,200})/i,
      /(?:invitation for|supply of)[:\s]+([^\n]{5,200})/i,
    ],
  },
  tenderNumber: {
    labels: ['tender no', 'nit no', 'e-tender', 'tender id'],
    patterns: [
      /tender\s*(?:no|number|id)[.:\s]*([A-Z0-9/\-_.]{3,40})/i,
      /nit\s*(?:no|number)[.:\s]*([A-Z0-9/\-_.]{3,40})/i,
    ],
  },
  estimatedTenderValue: {
    labels: ['tender value', 'estimated value', 'contract value', 'cost of work'],
    patterns: [
      /(?:tender value|estimated (?:contract )?value|cost of work)[^₹\d]{0,40}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?(?:\s*(?:Cr|Lakh|Lac))?)/i,
    ],
  },
  emdAmount: {
    labels: ['emd', 'earnest money', 'bid security'],
    patterns: [
      /(?:emd|earnest money(?: deposit)?)[^₹\d]{0,40}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?)/i,
    ],
  },
  tenderFee: {
    labels: ['tender fee', 'document fee'],
    patterns: [/tender fee[^₹\d]{0,30}((?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d+)?)/i],
  },
  performanceSecurity: {
    labels: ['performance security', 'security deposit'],
    patterns: [/performance security[^₹%\d]{0,30}([\d.,]+%?|(?:Rs\.?|₹)\s*[\d,]+)/i],
  },
  bankGuarantee: {
    labels: ['bank guarantee', 'pbg', 'performance bank guarantee'],
    patterns: [/bank guarantee[^₹%\d]{0,30}([\d.,]+%?|(?:Rs\.?|₹)\s*[\d,]+)/i],
  },
  bidSubmissionDate: {
    labels: ['last date', 'submission date', 'due date', 'bid submission end'],
    patterns: [
      /(?:last date|bid submission|due date)[^:\n]{0,40}[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
    ],
  },
  contractDuration: {
    labels: [
      'contract period',
      'completion period',
      'contract duration',
      'validity period',
      'engagement period',
      'period of contract',
    ],
    patterns: [
      /(?:contract period|completion (?:period|time)|duration|validity period|engagement period)[^:\n]{0,50}[:\s]+([^\n]{4,100})/i,
      /within\s+(\d+\s*(?:days|months|weeks|years))/i,
    ],
    pageHints: ['completion', 'duration', 'schedule', 'timeline'],
  },
  workLocation: {
    labels: [
      'work location',
      'site of work',
      'place of work',
      'project location',
      'site location',
      'location of service',
    ],
    patterns: [
      /(?:work location|site of work|place of work|project location|site location)[:\s]+([^\n]{3,120})/i,
    ],
    pageHints: ['location', 'site', 'place'],
  },
  submissionMode: {
    labels: [
      'mode of submission',
      'submission mode',
      'online bid',
      'e-tender',
      'online submission',
      'electronic submission',
    ],
    patterns: [
      /(?:mode of submission|submission mode)[:\s]+([^\n]{5,100})/i,
      /((?:online|electronic)\s*(?:bid|submission)[^\n]{0,80})/i,
    ],
    pageHints: ['submission', 'portal', 'e-tender', 'online'],
  },
  turnoverRequirements: {
    labels: ['turnover', 'annual turnover', 'average turnover', 'minimum turnover', 'financial capacity'],
    patterns: [/(?:turnover|annual turnover)[^:\n]{0,50}[:\s]+([^\n]{5,200})/i],
    pageHints: ['eligibility', 'qualification', 'financial', 'annexure'],
  },
  experienceRequirements: {
    labels: ['experience', 'similar work', 'past experience', 'similar nature', 'completed projects'],
    patterns: [/(?:experience|similar work)[^:\n]{0,50}[:\s]+([^\n]{5,250})/i],
    pageHints: ['eligibility', 'qualification', 'technical', 'annexure'],
  },
};

function scorePage(page: PageText, hints: string[]): number {
  const lower = page.text.toLowerCase();
  let score = 0;
  for (const h of hints) {
    if (lower.includes(h.toLowerCase())) score += 2;
  }
  for (const a of ANNEXURE_KEYWORDS) {
    if (lower.includes(a)) score += 1;
  }
  return score;
}

function searchPage(
  page: PageText,
  spec: NonNullable<(typeof FIELD_SEARCH)[IntelligenceFieldKey]>
): ExtractedField | null {
  const text = page.text;

  if (spec.patterns) {
    for (const p of spec.patterns) {
      const m = text.match(p);
      if (m?.[1]) {
        const value = m[1].trim().replace(/\s+/g, ' ');
        if (value.length >= 2 && value.length <= 350) {
          return { value, page: page.pageNumber, confidence: 0.85 };
        }
      }
    }
  }

  for (const label of spec.labels) {
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^:\\n]{0,50}[:\\s]+([^\\n]{3,200})`,
      'i'
    );
    const m = text.match(re);
    if (m?.[1]) {
      const value = m[1].trim().replace(/\s+/g, ' ');
      if (value.length >= 2 && value.length <= 350) {
        return { value, page: page.pageNumber, confidence: 0.8 };
      }
    }
  }

  return null;
}

class MissingDataRecovery {
  /**
   * Full-document recovery: annexures, schedules, tables, appendices.
   * Rule-only — no AI hallucination.
   */
  recover(
    pages: PageText[],
    targetFields: IntelligenceFieldKey[] = MANDATORY_FIELDS
  ): Partial<Record<IntelligenceFieldKey, ExtractedField[]>> {
    const result: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};

    const rankedPages = [...pages].sort((a, b) => {
      const sa = scorePage(a, ANNEXURE_KEYWORDS);
      const sb = scorePage(b, ANNEXURE_KEYWORDS);
      return sb - sa;
    });

    for (const fieldKey of targetFields) {
      const spec = FIELD_SEARCH[fieldKey];
      if (!spec) continue;

      const searchPages = spec.pageHints
        ? [...rankedPages].sort((a, b) => scorePage(b, spec.pageHints!) - scorePage(a, spec.pageHints!))
        : rankedPages;

      for (const page of searchPages) {
        const hit = searchPage(page, spec);
        if (hit) {
          result[fieldKey] = [...(result[fieldKey] || []), hit];
          break;
        }
      }
    }

    return result;
  }

  /** Recover all extractable fields across document (post initial rule pass). */
  recoverAll(pages: PageText[]): Partial<Record<IntelligenceFieldKey, ExtractedField[]>> {
    const full = localIntelligenceExtractor.extractFromPages(pages);
    const fromLocal = full[0]?.fields || {};

    const allKeys = Object.keys(FIELD_SEARCH) as IntelligenceFieldKey[];
    const recovered = this.recover(pages, allKeys);

    const merged: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = { ...fromLocal };
    for (const [k, extractions] of Object.entries(recovered)) {
      const key = k as IntelligenceFieldKey;
      if (extractions?.length) {
        merged[key] = [...(merged[key] || []), ...extractions];
      }
    }
    return merged;
  }
}

export const missingDataRecovery = new MissingDataRecovery();
