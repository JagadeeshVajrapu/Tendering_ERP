import { ProductionFieldDefinition } from '../fieldDefinitions';
import { FieldCandidate } from '../fieldLevelExtractor';

const FIELD_CONTEXT: Record<string, { prefer: RegExp[]; reject: RegExp[] }> = {
  emdAmount: {
    prefer: [/earnest\s+money/i, /\bemd\b/i, /bid\s+security/i, /tender\s+security/i],
    reject: [/performance\s+security/i, /performance\s+guarantee/i, /tender\s+fee/i, /turnover/i, /contract\s+value/i],
  },
  estimatedTenderValue: {
    prefer: [/estimated\s+(?:contract\s+)?value/i, /tender\s+value/i, /cost\s+of\s+work/i, /approximate\s+value/i],
    reject: [/earnest\s+money/i, /\bemd\b/i, /tender\s+fee/i, /turnover\s+requirement/i, /annual\s+turnover/i],
  },
  tenderFee: {
    prefer: [/tender\s+fee/i, /cost\s+of\s+tender\s+document/i, /document\s+fee/i, /non-?refundable\s+fee/i],
    reject: [/earnest\s+money/i, /\bemd\b/i, /performance\s+security/i, /turnover/i],
  },
  performanceSecurity: {
    prefer: [/performance\s+security/i, /performance\s+guarantee/i, /security\s+deposit/i],
    reject: [/earnest\s+money/i, /\bemd\b/i, /tender\s+fee/i],
  },
  bankGuarantee: {
    prefer: [/bank\s+guarantee/i, /\bpbg\b/i, /performance\s+bank/i],
    reject: [/earnest\s+money/i, /tender\s+fee/i],
  },
  bidSecurityAmount: {
    prefer: [/bid\s+security/i, /earnest\s+money/i, /\bemd\b/i],
    reject: [/performance\s+security/i, /tender\s+fee/i, /turnover/i],
  },
};

const MONEY_VALUE = /(?:₹|rs\.?\s*|inr\s*)?[\d,]+(?:\.\d+)?/i;

export function scoreMoneyCandidate(
  def: ProductionFieldDefinition,
  candidate: FieldCandidate,
  sourceText: string
): number {
  const rules = FIELD_CONTEXT[def.id] || {
    prefer: def.labels.map((l) => new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
    reject: [/turnover\s+requirement/i, /annual\s+turnover/i],
  };

  let score = 0;
  const ctx = sourceText.toLowerCase();

  for (const p of rules.prefer) {
    if (p.test(ctx)) score += 35;
  }
  for (const r of rules.reject) {
    if (r.test(ctx)) score -= 55;
  }

  if (!MONEY_VALUE.test(candidate.value) && !/\d+\s*%/.test(candidate.value)) score -= 40;
  if (candidate.source === 'table') score += 12;

  return score;
}

export function shouldRejectMoneyCandidate(
  def: ProductionFieldDefinition,
  candidate: FieldCandidate,
  sourceText: string
): boolean {
  const rules = FIELD_CONTEXT[def.id];
  if (!rules) return false;
  const ctx = sourceText.toLowerCase();
  const hasPrefer = rules.prefer.some((p) => p.test(ctx));
  const hasReject = rules.reject.some((r) => r.test(ctx));
  if (hasReject && !hasPrefer) return true;
  return false;
}
