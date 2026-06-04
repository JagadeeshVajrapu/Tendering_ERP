import { FieldCandidate } from '../fieldLevelExtractor';

const PREFER_CONTEXT =
  /contract\s+(?:period|duration)|period\s+of\s+(?:completion|contract)|duration\s+of\s+(?:contract|work|engagement)|completion\s+period|time\s+for\s+completion/i;

const REJECT_CONTEXT =
  /bid\s+valid(?:ity)?|tender\s+valid(?:ity)?|agreement\s+execution|execution\s+of\s+(?:the\s+)?(?:contract|agreement)|within\s+\d+\s*days?\s+(?:from|of)\s+(?:date|signing|award)|defect\s+liability|warranty\s+period|performance\s+guarantee\s+period/i;

const REJECT_VALUE_SHORT_DAYS = /^\d{1,2}\s*days?$/i;

/** Convert duration to approximate months for comparison. */
export function durationToMonths(value: string): number {
  const t = value.toLowerCase();
  const m = t.match(/(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?|weeks?|days?)/i);
  if (!m) {
    if (/(?:one|two|three|four|five|six)\s*(?:year|month)/i.test(t)) {
      if (/year/i.test(t)) return 12;
      if (/month/i.test(t)) return 1;
    }
    return 0;
  }
  const n = parseFloat(m[1]);
  const unit = m[2];
  if (/year|yr/i.test(unit)) return n * 12;
  if (/month|mo/i.test(unit)) return n;
  if (/week/i.test(unit)) return n / 4;
  if (/day/i.test(unit)) return n / 30;
  return 0;
}

export function scoreDurationCandidate(
  candidate: FieldCandidate,
  sourceText: string
): number {
  let score = 0;
  const ctx = sourceText.toLowerCase();
  const val = candidate.value.toLowerCase();

  if (PREFER_CONTEXT.test(ctx)) score += 45;
  if (/contract\s+period|contract\s+duration/i.test(ctx)) score += 25;
  if (REJECT_CONTEXT.test(ctx)) score -= 80;
  if (REJECT_VALUE_SHORT_DAYS.test(val) && REJECT_CONTEXT.test(ctx)) score -= 50;

  const months = durationToMonths(candidate.value);
  if (months >= 6) score += 30;
  else if (months >= 1) score += 20;
  else if (months > 0 && months < 1) score -= 15;

  if (candidate.source === 'table' && PREFER_CONTEXT.test(ctx)) score += 15;

  return score;
}

export function shouldRejectDurationCandidate(
  candidate: FieldCandidate,
  sourceText: string
): boolean {
  const ctx = sourceText.toLowerCase();
  if (REJECT_CONTEXT.test(ctx) && !PREFER_CONTEXT.test(ctx)) return true;
  if (REJECT_VALUE_SHORT_DAYS.test(candidate.value.trim()) && /execution|validity|signing/i.test(ctx)) {
    return true;
  }
  return false;
}
