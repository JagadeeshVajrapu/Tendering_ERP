import { PageText } from '../../types/intelligence';
import { IExtractionRule, ExtractionRule } from '../../models/ExtractionRule';

export type NitFieldName =
  | 'Tender Number'
  | 'NIT Number'
  | 'Department'
  | 'Organization'
  | 'Work Name'
  | 'EMD'
  | 'Tender Value'
  | 'Bid Dates'
  | 'Eligibility'
  | 'Turnover'
  | 'Experience';

export type ExtractionMethod = 'exact' | 'regex' | 'alias' | 'fuzzy';

export interface ExtractedNitField {
  fieldName: NitFieldName;
  extractedValue: string;
  sourcePage: number;
  sourceText: string;
  extractionMethod: ExtractionMethod;
}

export interface MatchedRuleDebug {
  ruleId?: string;
  fieldName: NitFieldName;
  matchCount: number;
  matchedMethods: ExtractionMethod[];
}

export interface FailedRuleDebug {
  ruleId?: string;
  fieldName: NitFieldName;
  reason?: string;
}

export interface NitRulesDebugResult {
  successfulMatches: MatchedRuleDebug[];
  failedMatches: FailedRuleDebug[];
  extractedFields: ExtractedNitField[];
}

type RuleInput = IExtractionRule & { _id?: { toString(): string } | null };

const TARGET_FIELDS: NitFieldName[] = [
  'Tender Number',
  'NIT Number',
  'Department',
  'Organization',
  'Work Name',
  'EMD',
  'Tender Value',
  'Bid Dates',
  'Eligibility',
  'Turnover',
  'Experience',
];

const DEFAULT_RULES: Array<
  Pick<IExtractionRule, 'fieldName' | 'aliases' | 'regexPatterns' | 'priority'>
> = [
  {
    fieldName: 'Tender Number',
    priority: 10,
    aliases: ['Tender No', 'Tender Number', 'Tender ID', 'Bid Reference No'],
    regexPatterns: [
      '(?:Tender\\s*(?:No\\.?|Number|ID)|Bid\\s+Reference\\s+No\\.?)\\s*[:\\-–]\\s*([^\\n|]{1,80})',
    ],
  },
  {
    fieldName: 'NIT Number',
    priority: 9,
    aliases: ['NIT No', 'Notification No', 'NIT Ref'],
    regexPatterns: ['(?:NIT\\s*(?:No\\.?|Number|Ref))\\s*[:\\-–]\\s*([^\\n|]{1,80})'],
  },
  {
    fieldName: 'Department',
    priority: 8,
    aliases: ['Dept', 'Department Name'],
    regexPatterns: ['(?:Department|Dept)\\s*[:\\-–]\\s*([^\\n|]{1,120})'],
  },
  {
    fieldName: 'Organization',
    priority: 8,
    aliases: ['Issuing Authority', 'Office', 'Publisher', 'Organiser'],
    regexPatterns: [
      '(?:Organization|Organisation|Issuing\\s+Authority|Office|Publisher)\\s*[:\\-–]\\s*([^\\n|]{1,160})',
    ],
  },
  {
    fieldName: 'Work Name',
    priority: 7,
    aliases: ['Name of Work', 'Work Title', 'Subject'],
    regexPatterns: [
      '(?:Work\\s*Name|Name\\s+of\\s+Work|Work\\s+Title|Subject)\\s*[:\\-–]\\s*([^\\n|]{1,240})',
    ],
  },
  {
    fieldName: 'EMD',
    priority: 9,
    aliases: ['EMD', 'Earnest Money Deposit', 'Bid Security'],
    regexPatterns: [
      '(?:EMD|Earnest\\s+Money(?:\\s+Deposit)?|Bid\\s+Security)\\s*[:\\-–]\\s*([^\\n|]{1,100})',
    ],
  },
  {
    fieldName: 'Tender Value',
    priority: 9,
    aliases: ['Estimated Cost', 'Estimated Tender Value', 'Tender Amount', 'Cost'],
    regexPatterns: [
      '(?:Tender\\s*Value|Estimated\\s*Cost|Estimated\\s+Tender\\s+Value|Tender\\s+Amount|Estimated\\s+Cost)\\s*[:\\-–]\\s*([^\\n|]{1,120})',
    ],
  },
  {
    fieldName: 'Bid Dates',
    priority: 6,
    aliases: ['Bid Schedule', 'Bid Dates', 'Schedule'],
    regexPatterns: [
      '(?:Bid\\s*Start\\s*Date|Pre-?Bid\\s*Meeting\\s*Date|Technical\\s*Bid\\s*Date|Financial\\s*Bid\\s*Date|Bid\\s*End\\s*Date)\\s*[:\\-–]\\s*([^\\n|]{1,60})',
    ],
  },
  {
    fieldName: 'Eligibility',
    priority: 6,
    aliases: ['Eligibility Criteria', 'Qualification Criteria'],
    regexPatterns: ['(?:Eligibility\\s*(?:Criteria)?|Qualification\\s*(?:Criteria)?)\\s*[:\\-–]\\s*([^\\n|]{1,400})'],
  },
  {
    fieldName: 'Turnover',
    priority: 6,
    aliases: ['Average Annual Turnover', 'Annual Turnover', 'Turnover Criteria'],
    regexPatterns: [
      '(?:Turnover\\s*(?:Criteria)?|Average\\s+Annual\\s+Turnover|Annual\\s+Turnover)\\s*[:\\-–]\\s*([^\\n|]{1,120})',
    ],
  },
  {
    fieldName: 'Experience',
    priority: 6,
    aliases: ['Experience Criteria', 'Work Experience', 'Past Experience'],
    regexPatterns: [
      '(?:Experience\\s*(?:Criteria)?|Work\\s+Experience|Past\\s+Experience|Experience\\s+Requirement)\\s*[:\\-–]\\s*([^\\n|]{1,160})',
    ],
  },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\p{L}\p{N}:\-\/\.\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEvidenceLine(text: string, idx: number, maxLen = 260): string {
  const start = Math.max(0, text.lastIndexOf('\n', idx) + 1);
  const endNl = text.indexOf('\n', idx);
  const end = endNl === -1 ? text.length : endNl;
  return text.slice(start, end).trim().slice(0, maxLen);
}

function cleanValue(v: string, maxLen = 500): string {
  const t = normalize(v)
    .replace(/^[\-\:\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  // Avoid capturing long legal boilerplate chunks.
  if (t.length > maxLen) return t.slice(0, maxLen).trim();
  // Remove trailing bullet-ish fragments.
  return t.replace(/[\u2022\-\u00b7]\s*$/g, '').trim();
}

function levenshtein(a: string, b: string): number {
  const s = a;
  const t = b;
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const d = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen ? 1 - d / maxLen : 0;
}

function scoreByMethod(method: ExtractionMethod, sim?: number): number {
  if (method === 'exact') return 95;
  if (method === 'regex') return 90;
  if (method === 'alias') return 85;
  // fuzzy
  const s = typeof sim === 'number' ? sim : 0.75;
  return Math.round(Math.min(99, 65 + s * 35));
}

type Candidate = {
  value: string;
  sourcePage: number;
  sourceText: string;
  method: ExtractionMethod;
  confidence: number;
};

function extractByRegexOnPage(text: string, rule: RuleInput, pageNumber: number): Candidate[] {
  const candidates: Candidate[] = [];
  const patterns = rule.regexPatterns || [];

  for (const p of patterns) {
    let rx: RegExp | null = null;
    try {
      rx = new RegExp(p, 'gi');
    } catch {
      continue;
    }

    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const raw = (m[1] || m[0] || '').trim();
      const value = cleanValue(raw, 800);
      if (!value) continue;
      const confidence = scoreByMethod('regex');
      candidates.push({
        value,
        sourcePage: pageNumber,
        sourceText: findEvidenceLine(text, m.index ?? 0),
        method: 'regex',
        confidence,
      });
      if (candidates.length >= 6) break;
    }
    if (candidates.length >= 6) break;
  }

  return candidates;
}

function extractByExactLabelOnPage(text: string, rule: RuleInput, pageNumber: number): Candidate[] {
  const candidates: Candidate[] = [];
  const label = rule.fieldName;
  if (!label) return candidates;

  const rx = new RegExp(
    `\\b${escapeRegex(label)}\\b\\s*[:\\-–]\\s*([^\\n|]{1,200})`,
    'gi'
  );

  rx.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const raw = (m[1] || '').trim();
    const value = cleanValue(raw, 600);
    if (!value) continue;
    candidates.push({
      value,
      sourcePage: pageNumber,
      sourceText: findEvidenceLine(text, m.index ?? 0),
      method: 'exact',
      confidence: scoreByMethod('exact'),
    });
    if (candidates.length >= 6) break;
  }
  return candidates;
}

function extractByAliasLabelOnPage(text: string, rule: RuleInput, pageNumber: number): Candidate[] {
  const candidates: Candidate[] = [];
  const aliases = [rule.fieldName, ...(rule.aliases || [])].filter(Boolean);

  for (const a of aliases) {
    const rx = new RegExp(`\\b${escapeRegex(a)}\\b\\s*[:\\-–]\\s*([^\\n|]{1,200})`, 'gi');
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const raw = (m[1] || '').trim();
      const value = cleanValue(raw, 600);
      if (!value) continue;
      const method: ExtractionMethod = normalize(a) === normalize(rule.fieldName) ? 'exact' : 'alias';
      candidates.push({
        value,
        sourcePage: pageNumber,
        sourceText: findEvidenceLine(text, m.index ?? 0),
        method,
        confidence: scoreByMethod(method),
      });
      if (candidates.length >= 6) break;
    }
    if (candidates.length >= 6) break;
  }

  return candidates;
}

function extractByFuzzyLabelOnPage(text: string, rule: RuleInput, pageNumber: number): Candidate[] {
  const candidates: Candidate[] = [];
  const expectedLabels = [rule.fieldName, ...(rule.aliases || [])].filter(Boolean);
  const lines = text.split('\n');

  for (const line of lines) {
    const sepMatch = line.match(/[:\-\u2013\u2014]\s*/);
    if (!sepMatch) continue;

    const idx = line.indexOf(sepMatch[0]);
    if (idx < 0) continue;

    const labelPart = line.slice(0, idx).trim();
    const valuePart = line.slice(idx + sepMatch[0].length).trim();

    if (labelPart.length < 3 || valuePart.length < 2) continue;

    let bestSim = 0;
    for (const lab of expectedLabels) {
      bestSim = Math.max(bestSim, similarity(lab, labelPart));
    }
    // Threshold tuned for OCR noise (typos, missing dots/spaces).
    if (bestSim < 0.84) continue;

    const value = cleanValue(valuePart, 600);
    if (!value) continue;

    candidates.push({
      value,
      sourcePage: pageNumber,
      sourceText: line.trim().slice(0, 260),
      method: 'fuzzy',
      confidence: scoreByMethod('fuzzy', bestSim),
    });
    if (candidates.length >= 6) break;
  }

  return candidates;
}

function pickBestCandidate(cands: Candidate[]): Candidate | null {
  if (!cands.length) return null;
  // Best by confidence, then prefer earlier pages (more likely header pages).
  return cands.sort((a, b) => b.confidence - a.confidence || a.sourcePage - b.sourcePage)[0] || null;
}

function mergeRulesForTargetFields(dbRules: IExtractionRule[]): RuleInput[] {
  const dbByField = new Map<string, IExtractionRule[]>();
  for (const r of dbRules) {
    const list = dbByField.get(r.fieldName) || [];
    list.push(r);
    dbByField.set(r.fieldName, list);
  }

  const defaultsByField = new Map<
    string,
    Array<Pick<IExtractionRule, 'fieldName' | 'aliases' | 'regexPatterns' | 'priority'>>
  >();
  for (const d of DEFAULT_RULES) {
    const list = defaultsByField.get(d.fieldName) || [];
    list.push(d);
    defaultsByField.set(d.fieldName, list);
  }

  const out: RuleInput[] = [];
  for (const f of TARGET_FIELDS) {
    const db = dbByField.get(f) || [];
    if (db.length) {
      out.push(...db);
      continue;
    }
    const defs = defaultsByField.get(f) || [];
    out.push(
      ...defs.map((d, i) => ({
        ...(d as any),
        active: true,
        priority: d.priority,
        aliases: d.aliases,
        regexPatterns: d.regexPatterns,
        fieldName: d.fieldName,
        _id: null,
      }))
    );
  }
  return out.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function extractBidDates(pages: PageText[], fieldRules: RuleInput[]): ExtractedNitField | null {
  // For Bid Dates, we combine multiple sub-date labels into one string.
  const subLabels = [
    'Bid Start Date',
    'Bid End Date',
    'Pre-Bid Meeting Date',
    'Pre Bid Meeting Date',
    'Prebid Meeting Date',
    'Technical Bid Date',
    'Financial Bid Date',
    'Bid Opening Date',
  ];
  const dateLike = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g;

  let best: { value: string; method: ExtractionMethod; sourcePage: number; sourceText: string; confidence: number } | null =
    null;

  for (const page of pages) {
    const text = page.text || '';
    if (!text.trim()) continue;

    const found: Array<{ label: string; value: string; method: ExtractionMethod; evidence: string }> = [];

    // Regex-first: Bid date values often appear as `Bid Start Date: ...`
    for (const rule of fieldRules) {
      const regexCandidates = extractByRegexOnPage(text, rule, page.pageNumber);
      for (const c of regexCandidates) {
        if (found.length >= 12) break;
        found.push({
          label: 'Bid Date',
          value: c.value,
          method: 'regex',
          evidence: c.sourceText,
        });
      }
      if (found.length >= 12) break;
    }

    const lines = text.split('\n').map((l) => l.trim());
    // Continue collecting label-based date lines too.

    for (const line of lines) {
      const sep = line.match(/[:\-\u2013\u2014]\s*/);
      if (!sep) continue;
      const idx = line.indexOf(sep[0]);
      const labelPart = line.slice(0, idx).trim();
      const valuePart = line.slice(idx + sep[0].length).trim();

      // Exact/alias match on sub-labels first.
      const matchedLabel = subLabels.find((sl) => normalize(sl).includes(normalize(labelPart)));
      if (matchedLabel) {
        const method: ExtractionMethod = normalize(matchedLabel) === normalize(labelPart) ? 'exact' : 'alias';
        const datesInValue = valuePart.match(dateLike);
        const val = datesInValue?.[0] ? datesInValue.join(' ') : cleanValue(valuePart, 140);
        if (val) found.push({ label: matchedLabel, value: val, method, evidence: line.trim().slice(0, 260) });
        continue;
      }

      // Fuzzy: approximate label matching.
      let bestSim = 0;
      let bestLabel = '';
      for (const sl of subLabels) {
        const sim = similarity(sl, labelPart);
        if (sim > bestSim) {
          bestSim = sim;
          bestLabel = sl;
        }
      }
      if (bestSim >= 0.88 && bestLabel) {
        const datesInValue = valuePart.match(dateLike);
        const val = datesInValue?.[0] ? datesInValue.join(' ') : cleanValue(valuePart, 140);
        if (val)
          found.push({
            label: bestLabel,
            value: val,
            method: 'fuzzy',
            evidence: line.trim().slice(0, 260),
          });
      }
    }

    if (!found.length) continue;

    const combined = found
      .slice(0, 6)
      .map((f) => `${f.label}: ${f.value}`)
      .join(' | ');

    const method: ExtractionMethod = found.some((f) => f.method === 'regex')
      ? 'regex'
      : found.some((f) => f.method === 'fuzzy')
        ? 'fuzzy'
        : found.some((f) => f.method === 'alias')
          ? 'alias'
          : 'exact';

    const confidence = Math.round(70 + Math.min(30, found.length * 4));
    const candidate = {
      value: combined,
      method,
      sourcePage: page.pageNumber,
      sourceText: found[0].evidence ? found[0].evidence : `Page ${page.pageNumber}`,
      confidence,
    };

    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  if (!best) return null;
  return {
    fieldName: 'Bid Dates',
    extractedValue: best.value,
    sourcePage: best.sourcePage,
    sourceText: best.sourceText,
    extractionMethod: best.method,
  };
}

export class NitRuleExtractionEngine {
  async loadActiveRules(): Promise<IExtractionRule[]> {
    return ExtractionRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 });
  }

  extractFromOcrPages(pages: PageText[], rules: RuleInput[]): NitRulesDebugResult {
    const extractedByField = new Map<NitFieldName, ExtractedNitField>();

    const successfulMatches: MatchedRuleDebug[] = [];
    const failedMatches: FailedRuleDebug[] = [];

    const pagesInOrder = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const textByPage = pagesInOrder.map((p) => p.text || '');

    for (const fieldName of TARGET_FIELDS) {
      const fieldRules = rules.filter((r) => r.fieldName === fieldName);

      // Bid Dates is multi-match.
      if (fieldName === 'Bid Dates') {
        const bid = extractBidDates(pagesInOrder, fieldRules);
        if (bid) extractedByField.set('Bid Dates', bid);
        // Mark all evaluated rules as matched/failed for transparency.
        for (const r of fieldRules) {
          if (bid) {
            successfulMatches.push({
              ruleId: r._id ? String((r._id as any).toString?.() ?? r._id) : undefined,
              fieldName,
              matchCount: 1,
              matchedMethods: [bid.extractionMethod],
            });
          } else {
            failedMatches.push({
              ruleId: r._id ? String((r._id as any).toString?.() ?? r._id) : undefined,
              fieldName,
              reason: 'No bid date labels matched in OCR text',
            });
          }
        }
        continue;
      }

      let best: Candidate | null = null;

      for (const rule of fieldRules) {
        let candidates: Candidate[] = [];

        for (let i = 0; i < pagesInOrder.length; i++) {
          const page = pagesInOrder[i];
          const text = textByPage[i];
          if (!text || !text.trim()) continue;

          // Evaluate all supported match types.
          const byRegex = extractByRegexOnPage(text, rule, page.pageNumber);
          const byExact = extractByExactLabelOnPage(text, rule, page.pageNumber);
          const byAlias = extractByAliasLabelOnPage(text, rule, page.pageNumber);
          const byFuzzy = extractByFuzzyLabelOnPage(text, rule, page.pageNumber);

          candidates.push(...byRegex, ...byExact, ...byAlias, ...byFuzzy);

          const bestForNow = pickBestCandidate(candidates);
          if (bestForNow && bestForNow.confidence >= 98) break; // early stop
        }

        const matched = candidates.length > 0;
        if (!matched) {
          failedMatches.push({
            ruleId: rule._id ? String((rule._id as any).toString?.() ?? rule._id) : undefined,
            fieldName,
            reason: 'No exact, alias, regex, or fuzzy match found',
          });
          continue;
        }

        const bestForRule = pickBestCandidate(candidates);
        if (!bestForRule) continue;

        const value = bestForRule.value;
        if (!value) continue;

        // If multiple rules extract the same field, keep the highest confidence.
        if (!best || bestForRule.confidence > best.confidence) best = bestForRule;

        const matchedMethods = Array.from(
          new Set(candidates.map((c) => c.method))
        ) as ExtractionMethod[];
        successfulMatches.push({
          ruleId: rule._id ? String((rule._id as any).toString?.() ?? rule._id) : undefined,
          fieldName,
          matchCount: candidates.length,
          matchedMethods,
        });
      }

      if (best) {
        extractedByField.set(fieldName, {
          fieldName,
          extractedValue: best.value,
          sourcePage: best.sourcePage,
          sourceText: best.sourceText,
          extractionMethod: best.method,
        });
      } else if (fieldRules.length && !failedMatches.some((f) => f.fieldName === fieldName)) {
        failedMatches.push({
          fieldName,
          reason: 'Candidates found but none passed validation',
        });
      }
    }

    return {
      successfulMatches,
      failedMatches,
      extractedFields: TARGET_FIELDS
        .map((f) => extractedByField.get(f))
        .filter((x): x is ExtractedNitField => !!x),
    };
  }
}

export const nitRuleExtractionEngine = new NitRuleExtractionEngine();

export function buildRulesForNITExtraction(dbRules: IExtractionRule[]): RuleInput[] {
  return mergeRulesForTargetFields(dbRules);
}

