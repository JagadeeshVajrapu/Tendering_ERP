import { FeasibilityRecommendation } from '../../types/intelligence';
import { ExtractedProductionField } from './extractedProductionField';
import { getVerifiedFieldValue } from './executiveDisplayFormatter';
import { VERIFICATION_STORE_THRESHOLD } from './fieldVerificationPipeline';

function pick(fields: ExtractedProductionField[], ids: string[]): string | null {
  return getVerifiedFieldValue(fields, ids)?.value ?? null;
}

function short(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Stage 11 — Executive summary (max 10 bullets, &lt;60 second read).
 * Verified fields only — concise consultant bullets, no paragraphs.
 */
export function buildExecutiveSummaryFromValidated(
  productionFields: ExtractedProductionField[],
  recommendation: FeasibilityRecommendation
): string[] {
  const bullets: string[] = [];
  const verified = productionFields.filter(
    (f) => f.validated && f.value && f.confidence >= VERIFICATION_STORE_THRESHOLD
  );

  const authority = pick(verified, ['issuingAuthority', 'organization']);
  const tenderNo = pick(verified, ['tenderNumber', 'tenderReferenceNumber']);
  if (authority || tenderNo) {
    bullets.push(
      `Tender: ${[authority, tenderNo].filter(Boolean).join(' · ')}`.slice(0, 120)
    );
  }

  const scope = pick(verified, ['scopeOfWork']);
  if (scope) bullets.push(`Scope: ${short(scope, 100)}`);

  const elig = pick(verified, ['turnoverRequirements', 'experienceRequirements']);
  const cert = pick(verified, ['certificationsRequired']);
  const eligParts = [elig, cert].filter(Boolean);
  if (eligParts.length) {
    bullets.push(`Eligibility: ${short(eligParts.join(' · '), 110)}`);
  }

  const value = pick(verified, ['estimatedTenderValue']);
  const emd = pick(verified, ['emdAmount']);
  const fin = [value && `Value ${value}`, emd && `EMD ${emd}`].filter(Boolean);
  if (fin.length) bullets.push(`Financial: ${fin.join(' · ')}`);

  const sub = pick(verified, ['bidSubmissionDate']);
  const open = pick(verified, ['bidOpeningDate']);
  const dur = pick(verified, ['contractDuration']);
  const time = [sub && `Submit ${sub}`, open && `Open ${open}`, dur && dur].filter(Boolean);
  if (time.length) bullets.push(`Timeline: ${time.join(' · ')}`.slice(0, 120));

  const tech = pick(verified, ['technicalRequirements']) || cert;
  if (tech && bullets.length < 9) bullets.push(`Technical: ${short(tech, 90)}`);

  const docs = verified.find((f) => f.id === 'requiredDocuments');
  if (docs?.value && bullets.length < 9) {
    const n = Array.isArray(docs.value) ? docs.value.length : 1;
    bullets.push(`Documents: ${n} verified submission item(s)`);
  }

  const risks = verified.find((f) => f.id === 'risks');
  if (risks?.value) {
    const item = Array.isArray(risks.value) ? risks.value[0] : risks.value;
    bullets.push(`Risk: ${short(String(item), 100)}`);
  } else if (
    ['emdAmount', 'bidSubmissionDate', 'contractDuration'].filter((id) => !pick(verified, [id])).length >= 2
  ) {
    bullets.push('Risk: Core commercial/timeline data incomplete — verify before bid');
  }

  bullets.push(`Recommendation: ${recommendation}`);

  return bullets.slice(0, 10);
}
