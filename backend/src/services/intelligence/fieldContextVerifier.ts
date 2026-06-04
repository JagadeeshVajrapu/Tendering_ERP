import { classifyPageTags } from './documentPageContext';
import { getContextRules } from './fieldContextRules';
import { ProductionFieldDefinition } from './fieldDefinitions';
import {
  computeFieldConfidence,
  normalizeFieldValue,
} from './fieldNormalizer';
import { FieldCandidate } from './fieldLevelExtractor';
import { PageText } from '../../types/intelligence';

export interface ContextVerificationResult {
  accepted: boolean;
  contextScore: number;
  headingScore: number;
  formatScore: number;
  sectionScore: number;
  rejectReason?: string;
  sourceText: string;
  sectionHint: string;
  normalizedValue?: string;
}

const CONTEXT_WINDOW = 450;

export function extractSourceSnippet(pageText: string, matchStart: number, valueLength: number): string {
  const start = Math.max(0, matchStart - CONTEXT_WINDOW);
  const end = Math.min(pageText.length, matchStart + valueLength + CONTEXT_WINDOW);
  let snippet = pageText.slice(start, end).replace(/\s+/g, ' ').trim();
  if (snippet.length > 320) {
    const relStart = matchStart - start;
    const sliceStart = Math.max(0, relStart - 120);
    snippet = snippet.slice(sliceStart, sliceStart + 300).trim();
  }
  return snippet;
}

function findMatchIndex(pageText: string, value: string, hint?: number): number {
  if (hint !== undefined && hint >= 0) return hint;
  const idx = pageText.toLowerCase().indexOf(value.toLowerCase());
  return idx >= 0 ? idx : 0;
}

function detectSectionHeading(context: string): string {
  const lines = context.split(/(?<=[.!?])\s+|\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 8; i--) {
    const line = lines[i];
    if (line.length < 8 || line.length > 120) continue;
    if (/^[A-Z0-9][A-Za-z0-9\s\-–—:()]+$/.test(line) && !/shall|must|will/i.test(line)) {
      return line;
    }
  }
  const caps = context.match(/(?:^|\n)([A-Z][A-Z\s]{6,60})(?:\n|$)/);
  return caps?.[1]?.trim() || '';
}

/**
 * Normalize → format validate → context verify (never accept fragments).
 */
export function verifyCandidateContext(
  candidate: FieldCandidate,
  def: ProductionFieldDefinition,
  page: PageText
): ContextVerificationResult {
  const rules = getContextRules(def.id);
  const matchStart = findMatchIndex(page.text, candidate.value, candidate.matchStart);
  const sourceText = candidate.sourceText || extractSourceSnippet(page.text, matchStart, candidate.value.length);
  const heading = detectSectionHeading(sourceText);

  const norm = normalizeFieldValue(candidate.value, def);
  if (norm.rejected || !norm.normalized) {
    return {
      accepted: false,
      contextScore: 0,
      headingScore: 0,
      formatScore: 0,
      sectionScore: 0,
      rejectReason: norm.rejectReason || 'Fragment or invalid format',
      sourceText,
      sectionHint: heading,
    };
  }

  const value = norm.normalized;

  for (const rej of rules.rejectContext) {
    if (rej.test(sourceText)) {
      return {
        accepted: false,
        contextScore: 0,
        headingScore: 0,
        formatScore: norm.formatScore,
        sectionScore: 0,
        rejectReason: `Wrong clause context`,
        sourceText,
        sectionHint: heading,
      };
    }
  }

  if (rules.rejectValue?.some((r) => r.test(value))) {
    return {
      accepted: false,
      contextScore: 0,
      headingScore: 0,
      formatScore: norm.formatScore,
      sectionScore: 0,
      rejectReason: 'Value shape inconsistent with field',
      sourceText,
      sectionHint: heading,
    };
  }

  let contextScore = 0.2;
  let headingScore = 0;
  let sectionScore = 0;

  const acceptHits = rules.acceptContext.filter((r) => r.test(sourceText)).length;
  contextScore += Math.min(0.35, acceptHits * 0.12);

  if (rules.acceptHeadings.some((r) => r.test(heading) || r.test(sourceText.slice(0, 200)))) {
    headingScore = 0.15;
  }

  const pageTags = classifyPageTags(page);
  if (rules.preferredSections?.some((s) => pageTags.includes(s as never))) {
    sectionScore = 0.85;
  }

  if (candidate.source === 'table' && acceptHits > 0) {
    contextScore += 0.1;
  }

  if (def.labels.some((l) => new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(sourceText))) {
    contextScore += 0.08;
  }

  contextScore = Math.min(1, contextScore + headingScore);

  const fieldSpecificMin = def.id === 'contractDuration' ? 0.35 : 0.3;
  const hasEvidence =
    acceptHits > 0 ||
    headingScore > 0 ||
    sectionScore > 0 ||
    candidate.source === 'table' ||
    candidate.source === 'label' ||
    candidate.source === 'pattern' ||
    norm.formatScore >= 0.8;

  const accepted =
    norm.formatScore >= 0.7 &&
    (hasEvidence || norm.formatScore >= 0.88) &&
    (contextScore >= fieldSpecificMin || norm.formatScore >= 0.9);

  if (!accepted) {
    return {
      accepted: false,
      contextScore,
      headingScore,
      formatScore: norm.formatScore,
      sectionScore,
      rejectReason: 'Insufficient contextual relevance or format match',
      sourceText,
      sectionHint: heading,
      normalizedValue: value,
    };
  }

  return {
    accepted: true,
    contextScore,
    headingScore,
    formatScore: norm.formatScore,
    sectionScore,
    sourceText,
    sectionHint: heading,
    normalizedValue: value,
  };
}

export interface VerifiedFieldCandidate extends FieldCandidate {
  sourceText: string;
  contextScore: number;
  formatScore: number;
  sectionScore: number;
  verificationScore: number;
  accepted: boolean;
  rejectReason?: string;
  sectionHint?: string;
  normalizedValue: string;
  verificationPass?: 'rule' | 'context' | 'ai' | 'cross' | 'final';
}

export function scoreVerifiedCandidate(
  candidate: FieldCandidate,
  verification: ContextVerificationResult,
  def: ProductionFieldDefinition,
  crossRank = 1,
  extras?: { tableMatchScore?: number; aiVerificationScore?: number }
): number {
  if (!verification.accepted || !verification.normalizedValue) return 0;

  const crossScore = crossRank === 1 ? 1 : crossRank === 2 ? 0.7 : 0.4;
  const tableMatchScore =
    extras?.tableMatchScore ??
    (candidate.source === 'table' ? Math.min(1, verification.contextScore + 0.35) : 0);

  const breakdown = computeFieldConfidence({
    contextScore: verification.contextScore,
    headingScore: verification.headingScore,
    formatScore: verification.formatScore,
    sectionMatchScore: verification.sectionScore,
    crossScore,
    tableMatchScore,
    aiVerificationScore: extras?.aiVerificationScore ?? 0,
  });

  return breakdown.total;
}
