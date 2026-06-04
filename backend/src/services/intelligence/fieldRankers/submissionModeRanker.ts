import { FieldCandidate } from '../fieldLevelExtractor';

const PREFER =
  /mode\s+of\s+submission|submission\s+mode|online\s+(?:bid|submission)|e-?tender|gem\s+portal|nic\s+portal|electronic\s+submission|bidding\s+mode/i;

const REJECT_CONTEXT =
  /technical\s+requirement|technical\s+specification|scope\s+of\s+work|supply\s+of|cctv|camera|equipment|installation|eligibility\s+criteria|turnover|earnest\s+money/i;

const REJECT_VALUE =
  /technical\s+requirement|specification|cctv|camera|supply\s+of|shall\s+comply|warranty|maintenance/i;

const ALLOWED_SHORT =
  /^(?:online|offline|e-?tender|gem\s+portal|nic\s+portal|cpp\s+portal|electronic\s+submission)$/i;

export function scoreSubmissionModeCandidate(
  candidate: FieldCandidate,
  sourceText: string
): number {
  const v = candidate.value.trim();
  const ctx = sourceText.toLowerCase();

  if (REJECT_VALUE.test(v)) return 2;
  if (REJECT_CONTEXT.test(ctx) && !PREFER.test(ctx)) return 5;

  let score = 0;

  if (ALLOWED_SHORT.test(v)) score = 98;
  else if (/^online$/i.test(v)) score = 98;
  else if (/^gem$/i.test(v) || (/gem/i.test(v) && v.length < 20)) score = 95;
  else if (/e-?tender/i.test(v) && v.split(/\s+/).length <= 4) score = 90;
  else if (/nic\s+portal/i.test(v)) score = 92;
  else if (/\bonline\b/i.test(v) && v.split(/\s+/).length <= 6) score = 85;
  else if (/\boffline\b/i.test(v)) score = 80;
  else score = 15;

  if (PREFER.test(ctx)) score = Math.min(99, score + 8);
  if (candidate.source === 'table' && PREFER.test(ctx)) score = Math.min(99, score + 5);
  if (v.split(/\s+/).length > 8) score = Math.min(score, 10);

  return score;
}

export function shouldRejectSubmissionModeCandidate(
  candidate: FieldCandidate,
  sourceText: string
): boolean {
  const v = candidate.value.trim();
  if (REJECT_VALUE.test(v)) return true;
  if (v.split(/\s+/).length > 10) return true;
  if (REJECT_CONTEXT.test(sourceText) && !PREFER.test(sourceText)) return true;
  if (scoreSubmissionModeCandidate(candidate, sourceText) < 40) return true;
  return false;
}
