import { Types } from 'mongoose';
import { IExtractionRule, ExtractionRule } from '../../models/ExtractionRule';
import { IExtractedField, MatchType } from '../../models/TenderExtraction';

const FIELD_ORDER = [
  'Tender Number',
  'NIT Number',
  'Tender Title',
  'Work Name',
  'Department',
  'Organization',
  'Location',
  'Tender Value',
  'Estimated Cost',
  'EMD Amount',
  'Document Fee',
  'Bid Start Date',
  'Bid End Date',
  'Technical Bid Date',
  'Financial Bid Date',
  'Pre-Bid Meeting Date',
  'Contact Name',
  'Contact Email',
  'Contact Phone',
  'Eligibility Criteria',
  'Experience Criteria',
  'Turnover Criteria',
  'Completion Period',
] as const;

type FieldName = (typeof FIELD_ORDER)[number];

function scoreFromMatchType(t: MatchType): number {
  if (t === 'exact') return 95;
  if (t === 'regex') return 90;
  if (t === 'alias') return 85;
  return 75;
}

function findEvidenceLine(text: string, idx: number): string {
  const start = Math.max(0, text.lastIndexOf('\n', idx) + 1);
  const endNl = text.indexOf('\n', idx);
  const end = endNl === -1 ? text.length : endNl;
  return text.slice(start, end).trim().slice(0, 300);
}

function compilePatterns(rule: IExtractionRule): RegExp[] {
  const out: RegExp[] = [];
  for (const p of rule.regexPatterns || []) {
    try {
      out.push(new RegExp(p, 'gi'));
    } catch {
      // ignore invalid patterns
    }
  }
  return out;
}

function extractByRegex(text: string, rule: IExtractionRule): Array<{ value: string; evidence: string; matchType: MatchType }> {
  const patterns = compilePatterns(rule);
  const candidates: Array<{ value: string; evidence: string; matchType: MatchType }> = [];

  for (const rx of patterns) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const raw = (m[1] || m[0] || '').trim();
      if (!raw) continue;
      const evidence = findEvidenceLine(text, m.index);
      candidates.push({ value: raw, evidence, matchType: 'regex' });
      if (candidates.length >= 6) break;
    }
  }

  return candidates;
}

function extractByAliasLabel(text: string, rule: IExtractionRule): Array<{ value: string; evidence: string; matchType: MatchType }> {
  const aliases = [rule.fieldName, ...(rule.aliases || [])].filter(Boolean);
  const candidates: Array<{ value: string; evidence: string; matchType: MatchType }> = [];

  for (const a of aliases) {
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`\\b${escaped}\\b\\s*[:\\-–]\\s*(.{1,120})`, 'gi');
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text))) {
      const raw = (m[1] || '').trim();
      if (!raw) continue;
      const evidence = findEvidenceLine(text, m.index);
      const matchType: MatchType = a.toLowerCase() === rule.fieldName.toLowerCase() ? 'exact' : 'alias';
      candidates.push({ value: raw, evidence, matchType });
      if (candidates.length >= 6) break;
    }
  }

  return candidates;
}

class TenderRuleEngineService {
  async getActiveRules(): Promise<IExtractionRule[]> {
    return ExtractionRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 });
  }

  extractFields(text: string, rules: IExtractionRule[]): IExtractedField[] {
    const byField = new Map<string, IExtractedField>();

    // Evaluate rules in priority order; keep best confidence per field.
    for (const rule of rules) {
      const fieldName = rule.fieldName as FieldName;
      if (!FIELD_ORDER.includes(fieldName)) continue;

      const candidates = [
        ...extractByRegex(text, rule),
        ...extractByAliasLabel(text, rule),
      ];

      for (const c of candidates) {
        const confidence = scoreFromMatchType(c.matchType);
        const existing = byField.get(fieldName);
        if (!existing || confidence > existing.confidence) {
          byField.set(fieldName, {
            fieldName,
            value: c.value,
            confidence,
            matchType: c.matchType,
            ruleId: new Types.ObjectId(rule._id),
            evidence: c.evidence,
          });
        }
      }
    }

    // Return ordered list (stable UI)
    const out: IExtractedField[] = [];
    for (const f of FIELD_ORDER) {
      const v = byField.get(f);
      if (v) out.push(v);
    }
    return out;
  }
}

export const ruleEngineService = new TenderRuleEngineService();

