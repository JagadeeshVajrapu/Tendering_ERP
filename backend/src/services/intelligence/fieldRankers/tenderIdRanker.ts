import { FieldCandidate } from '../fieldLevelExtractor';

const TENDER_ID =
  /\b[A-Z]{2,}[A-Z0-9]*(?:[/\-_.][A-Z0-9]+)+\b|\b\d{4,}[/-]\d{2,}[/-][A-Z0-9/\-_.]+\b/i;

const FRAGMENT_REJECT = /^(?:tice|tend|emen|nit|refe|no\.?)$/i;

export function scoreTenderIdCandidate(candidate: FieldCandidate, sourceText: string): number {
  let score = 0;
  const val = candidate.value.trim();

  if (FRAGMENT_REJECT.test(val)) return -100;
  if (val.length <= 4 && !/\d/.test(val)) return -80;

  if (TENDER_ID.test(val)) score += 70;
  if (/[A-Za-z]/.test(val) && /\d/.test(val)) score += 25;
  if (val.includes('/') || val.includes('-')) score += 15;

  if (/tender\s*(?:no|number|id)/i.test(sourceText)) score += 20;
  if (/nit\s*(?:no|number)/i.test(sourceText)) score += 20;
  if (candidate.source === 'table') score += 10;

  if (WORD_COUNT(val) > 6) score -= 30;
  if (!TENDER_ID.test(val) && val.length < 6) score -= 40;

  return score;
}

export function shouldRejectTenderIdCandidate(candidate: FieldCandidate): boolean {
  const val = candidate.value.trim();
  if (FRAGMENT_REJECT.test(val)) return true;
  if (val.length <= 5 && !TENDER_ID.test(val)) return true;
  if (!/[A-Za-z]/i.test(val) || !/\d/.test(val)) {
    if (!TENDER_ID.test(val)) return true;
  }
  return false;
}

function WORD_COUNT(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
