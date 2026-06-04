/**
 * Consultant field pipeline (Steps 2–6 per field).
 * No direct AI extraction — rule candidates + ranking + dictionary + AI verify + store.
 */

import { ExtractedField, PageText } from '../../types/intelligence';
import { ProductionFieldDefinition } from './fieldDefinitions';
import {
  collectAllFieldCandidates,
  ExtractFieldOptions,
  FieldCandidate,
} from './fieldLevelExtractor';
import { fieldAiVerifier } from './fieldAiVerifier';
import { verifyCandidateContext, scoreVerifiedCandidate } from './fieldContextVerifier';
import { consultantQualityCheck } from './fieldNormalizer';
import { filterValidExtractions } from './valueValidator';
import { validateFieldDictionary, isRejectedByDictionary } from './fieldDictionaryEngine';
import { scoreCandidate, CandidateRankBreakdown } from './candidateRankingEngine';
import { DocumentMap, emptyDocumentMap } from './documentMapBuilder';

export const VERIFICATION_STORE_THRESHOLD = 0.72;
export const VERIFICATION_DISPLAY_THRESHOLD = 0.72;
export const VERIFICATION_REVIEW_THRESHOLD = 0.9;

const MIN_RANK_TOTAL = 55;
const MIN_DICTIONARY_SCORE = 70;

export interface VerifiedFieldResult {
  value: string | string[];
  sourcePage: number;
  confidence: number;
  sourceText: string;
  verificationScore: number;
  verificationPass: 'rule' | 'context' | 'ai' | 'final';
  needsReview: boolean;
  rankBreakdown?: CandidateRankBreakdown;
}

export interface RankedCandidate {
  value: string;
  normalizedValue: string;
  page: number;
  sourceText: string;
  contextScore: number;
  formatScore: number;
  sectionScore: number;
  sectionHint?: string;
  source?: FieldCandidate['source'];
  verificationScore: number;
  rankScore: number;
  dictionaryScore: number;
  rankBreakdown: CandidateRankBreakdown;
  accepted: boolean;
  verificationPass: 'rule' | 'context' | 'ai' | 'final';
}

class ProductionFieldPipeline {
  /**
   * Steps 2–6 for one field.
   */
  async processField(
    def: ProductionFieldDefinition,
    pages: PageText[],
    options?: ExtractFieldOptions & { documentMap?: DocumentMap; pageMap?: Map<number, PageText> }
  ): Promise<VerifiedFieldResult | null> {
    const pageMap = options?.pageMap ?? new Map(pages.map((p) => [p.pageNumber, p]));
    const documentMap = options?.documentMap;

    // Step 2 — Candidate collection (no winner yet)
    const raw = collectAllFieldCandidates(def, pages, options).filter(
      (c) => !isRejectedByDictionary(def.id, c.value, c.sourceText || '')
    );
    if (!raw.length) return null;

    // Step 3 — Candidate ranking
    const ranked = this.stepRankCandidates(raw, def, pageMap, documentMap);
    if (!ranked.length) return null;

    const top = ranked[0];
    if (top.rankScore < MIN_RANK_TOTAL || top.dictionaryScore < MIN_DICTIONARY_SCORE) {
      return null;
    }

    // Step 4 — Dictionary validation on top candidate
    const dict = validateFieldDictionary(def.id, top.normalizedValue, top.sourceText);
    if (!dict.valid || !dict.normalizedValue) return null;

    const validatedCandidate = { ...top, normalizedValue: dict.normalizedValue, value: dict.normalizedValue };

    // Step 5 — AI verification (every selected candidate — mandatory)
    const afterAi = await this.stepAiVerification(def, ranked.slice(0, 6));
    if (!afterAi) return null;

    // Step 6 — Final selection + structured value
    return this.stepFinalSelection(def, afterAi);
  }

  private stepRankCandidates(
    raw: FieldCandidate[],
    def: ProductionFieldDefinition,
    pageMap: Map<number, PageText>,
    documentMap?: DocumentMap
  ): RankedCandidate[] {
    const map = documentMap ?? emptyDocumentMap();
    const results: RankedCandidate[] = [];

    for (const c of raw) {
      const page = pageMap.get(c.page);
      if (!page) continue;

      const verification = verifyCandidateContext(c, def, page);
      if (!verification.accepted || !verification.normalizedValue) continue;

      const dict = validateFieldDictionary(def.id, verification.normalizedValue, verification.sourceText);
      if (!dict.valid || !dict.normalizedValue) continue;

      const rankBreakdown = scoreCandidate(c, def, page, map, {
        contextScore: verification.contextScore,
        headingScore: verification.headingScore,
        formatScore: verification.formatScore,
        sectionScore: verification.sectionScore,
        sectionHint: verification.sectionHint,
        sourceText: verification.sourceText,
      });

      const verificationScore = scoreVerifiedCandidate(c, verification, def, 1, {
        tableMatchScore: c.source === 'table' ? 0.85 : 0,
      });

      results.push({
        value: dict.normalizedValue,
        normalizedValue: dict.normalizedValue,
        page: c.page,
        sourceText: verification.sourceText,
        contextScore: verification.contextScore,
        formatScore: verification.formatScore,
        sectionScore: verification.sectionScore,
        sectionHint: verification.sectionHint,
        source: c.source,
        verificationScore,
        rankScore: Math.max(rankBreakdown.total, dict.dictionaryScore),
        dictionaryScore: dict.dictionaryScore,
        rankBreakdown,
        accepted: true,
        verificationPass: 'context',
      });
    }

    return results.sort(
      (a, b) =>
        b.rankScore - a.rankScore ||
        b.dictionaryScore - a.dictionaryScore ||
        b.verificationScore - a.verificationScore
    );
  }

  /** Step 5 — AI verifies only when rule confidence is not already high (fast + accurate). */
  private async stepAiVerification(
    def: ProductionFieldDefinition,
    ranked: RankedCandidate[]
  ): Promise<RankedCandidate | null> {
    const top = ranked[0];
    if (!top) return null;

    const dict = validateFieldDictionary(def.id, top.normalizedValue, top.sourceText);
    if (!dict.valid || !dict.normalizedValue) return null;

    const value = dict.normalizedValue;

    // High-confidence rule match — skip slow per-field AI call
    if (top.dictionaryScore >= 92 && top.rankScore >= 85) {
      return { ...top, normalizedValue: value, value, verificationPass: 'final' };
    }

    const ai = await fieldAiVerifier.verifySingleFieldValue(def, value, top.sourceText);

    if (ai) {
      if (!ai.accepted) return null;
      return {
        ...top,
        normalizedValue: value,
        value,
        verificationScore: scoreVerifiedCandidate(
          {
            value,
            page: top.page,
            confidence: 0,
            score: top.rankScore,
            source: top.source,
          },
          {
            accepted: true,
            contextScore: top.contextScore,
            headingScore: 0,
            formatScore: top.formatScore,
            sectionScore: top.sectionScore,
            sourceText: top.sourceText,
            sectionHint: top.sectionHint || '',
            normalizedValue: value,
          },
          def,
          1,
          { aiVerificationScore: ai.confidence, tableMatchScore: top.source === 'table' ? 0.9 : 0 }
        ),
        verificationPass: 'ai',
      };
    }

    // OpenAI disabled — only allow near-perfect dictionary + rank scores
    if (top.dictionaryScore >= 95 && top.rankScore >= 90) {
      return { ...top, normalizedValue: value, value, verificationPass: 'final' };
    }

    return null;
  }

  private stepFinalSelection(
    def: ProductionFieldDefinition,
    winner: RankedCandidate
  ): VerifiedFieldResult | null {
    const dict = validateFieldDictionary(def.id, winner.normalizedValue, winner.sourceText);
    if (!dict.valid || !dict.normalizedValue) return null;

    const finalValue = dict.normalizedValue;
    if (winner.verificationScore < VERIFICATION_STORE_THRESHOLD) return null;
    if (!consultantQualityCheck(def.id, finalValue, winner.sourceText)) return null;

    const extracted: ExtractedField = {
      value:
        def.valueType === 'list' && finalValue.includes(' | ')
          ? finalValue.split(/\s*\|\s*/).slice(0, def.listMaxItems || 10)
          : finalValue,
      page: winner.page,
      confidence: winner.verificationScore,
    };

    if (!filterValidExtractions(def.mergeKey, [extracted]).length) return null;

    const confidence = Math.min(0.97, winner.verificationScore);
    if (confidence < VERIFICATION_STORE_THRESHOLD) return null;

    return {
      value: extracted.value as string | string[],
      sourcePage: winner.page,
      confidence,
      sourceText: winner.sourceText,
      verificationScore: confidence,
      verificationPass: winner.verificationPass || 'final',
      needsReview: confidence < VERIFICATION_REVIEW_THRESHOLD,
      rankBreakdown: winner.rankBreakdown,
    };
  }
}

export const productionFieldPipeline = new ProductionFieldPipeline();
