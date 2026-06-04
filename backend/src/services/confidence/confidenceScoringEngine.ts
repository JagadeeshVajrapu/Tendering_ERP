import {
  ConfidenceAiVerificationInput,
  ConfidenceExtractionMethod,
  ConfidenceScoreBreakdown,
  ConfidenceScoredField,
  ConfidenceScoringInput,
  ConfidenceScoringResult,
  ConfidenceScoringStatistics,
  ConfidenceValidationInput,
  LOW_CONFIDENCE_THRESHOLD,
} from '../../types/confidenceScoring';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isAiVerified(ai?: ConfidenceAiVerificationInput): boolean {
  if (!ai) return false;
  if (ai.correctness === 'incorrect') return false;
  return (ai.confidence ?? 0) >= 70 && Boolean(ai.verifiedValue?.trim());
}

function resolveValue(input: ConfidenceScoringInput): string {
  const ai = input.aiVerificationResult;
  if (isAiVerified(ai) && ai?.verifiedValue?.trim()) return ai.verifiedValue.trim();
  if (input.validationResult?.valid && input.validationResult.value?.trim()) {
    return input.validationResult.value.trim();
  }
  return String(input.extractedValue || '').trim();
}

function resolveMethod(input: ConfidenceScoringInput): ConfidenceExtractionMethod | 'unknown' {
  if (input.aiVerificationResult?.filledMissing) return 'ai_inferred';
  return input.extractionMethod || 'unknown';
}

class ConfidenceScoringEngine {
  scoreField(input: ConfidenceScoringInput): ConfidenceScoredField {
    const validated = Boolean(input.validationResult?.valid);
    const ai = input.aiVerificationResult;
    const aiVerified = isAiVerified(ai);
    const aiConfidence = ai?.confidence ?? null;
    const method = resolveMethod(input);
    const adjustments: string[] = [];

    let score = 0;
    let baseBand = 'unscored';
    let scoreBeforeAdjustments = 0;

    if (input.validationResult && !input.validationResult.valid) {
      score = clamp(15 + (aiConfidence ?? 0) * 0.15, 0, 35);
      baseBand = 'invalid-validation';
      scoreBeforeAdjustments = score;
      adjustments.push('Validation failed — capped below 40');
      if (input.validationResult.reason) adjustments.push(input.validationResult.reason);
    } else if (method === 'ai_inferred') {
      baseBand = '60-75 (AI inferred)';
      const aiScore = aiConfidence ?? 55;
      scoreBeforeAdjustments = 60 + ((aiScore - 50) / 50) * 15;
      score = clamp(scoreBeforeAdjustments, 60, 75);
      adjustments.push('Value inferred by GPT-4o from source evidence');
      if (!aiVerified) adjustments.push('AI verification uncertain — lower bound applied');
    } else if (method === 'exact' && validated && aiVerified) {
      baseBand = '95-100 (exact + validated + AI verified)';
      scoreBeforeAdjustments = 95 + (((aiConfidence ?? 70) - 70) / 30) * 5;
      score = clamp(scoreBeforeAdjustments, 95, 100);
    } else if (method === 'regex' && validated && aiVerified) {
      baseBand = '90-95 (regex + validated + AI verified)';
      scoreBeforeAdjustments = 90 + (((aiConfidence ?? 70) - 70) / 30) * 5;
      score = clamp(scoreBeforeAdjustments, 90, 95);
    } else if (method === 'alias' && validated && aiVerified) {
      baseBand = '85-90 (alias + validated + AI verified)';
      scoreBeforeAdjustments = 85 + (((aiConfidence ?? 70) - 70) / 30) * 5;
      score = clamp(scoreBeforeAdjustments, 85, 90);
    } else if (method === 'fuzzy' && validated) {
      baseBand = '75-85 (fuzzy + validated)';
      scoreBeforeAdjustments = aiVerified ? 80 + (((aiConfidence ?? 70) - 70) / 30) * 5 : 78;
      score = clamp(scoreBeforeAdjustments, 75, aiVerified ? 85 : 82);
      if (aiVerified) adjustments.push('AI verification boosted fuzzy match');
      else adjustments.push('Fuzzy match without AI verification — mid-band score');
    } else if (method === 'exact' && validated) {
      baseBand = '88-92 (exact + validated, no AI)';
      score = 90;
      scoreBeforeAdjustments = score;
      adjustments.push('Validated exact match; AI verification not available');
    } else if (method === 'regex' && validated) {
      baseBand = '82-88 (regex + validated, no AI)';
      score = 85;
      scoreBeforeAdjustments = score;
      adjustments.push('Validated regex match; AI verification not available');
    } else if (method === 'alias' && validated) {
      baseBand = '78-84 (alias + validated, no AI)';
      score = 81;
      scoreBeforeAdjustments = score;
      adjustments.push('Validated alias match; AI verification not available');
    } else if (method === 'fuzzy') {
      baseBand = '65-74 (fuzzy, not validated)';
      score = 68;
      scoreBeforeAdjustments = score;
      adjustments.push('Fuzzy extraction without validation');
    } else if (validated && aiVerified) {
      baseBand = '80-88 (validated + AI verified)';
      scoreBeforeAdjustments = 80 + (((aiConfidence ?? 70) - 70) / 30) * 8;
      score = clamp(scoreBeforeAdjustments, 80, 88);
    } else if (validated) {
      baseBand = '70-78 (validated only)';
      score = 74;
      scoreBeforeAdjustments = score;
      adjustments.push('Validated but extraction method unknown');
    } else {
      baseBand = '40-60 (unvalidated rule match)';
      score = 50;
      scoreBeforeAdjustments = score;
      adjustments.push('Rule match without validation or AI verification');
    }

    if (input.sourcePage >= 1 && input.sourcePage <= 3 && score < 100) {
      score = clamp(score + 2, 0, 100);
      adjustments.push('Early-page evidence bonus (+2)');
    }

    if (ai?.correctness === 'uncertain' && score > 70) {
      score = clamp(score - 8, 0, 100);
      adjustments.push('AI marked value as uncertain (-8)');
    }

    if (!resolveValue(input)) {
      score = 0;
      adjustments.push('Empty value — confidence zeroed');
    }

    const breakdown: ConfidenceScoreBreakdown = {
      extractionMethod: method,
      validated,
      aiVerified,
      aiConfidence,
      aiInferred: method === 'ai_inferred',
      baseBand,
      scoreBeforeAdjustments: clamp(scoreBeforeAdjustments, 0, 100),
      adjustments,
    };

    const value = resolveValue(input);
    const confidenceReason = this.buildReason(breakdown, score);

    return {
      fieldName: input.fieldName,
      value,
      confidence: clamp(score, 0, 100),
      confidenceReason,
      sourcePage: input.sourcePage,
      sourceText: input.sourceText,
      lowConfidence: score < LOW_CONFIDENCE_THRESHOLD,
      breakdown,
    };
  }

  scoreAll(inputs: ConfidenceScoringInput[]): ConfidenceScoringResult {
    const started = Date.now();
    const fields = inputs.map((input) => this.scoreField(input)).sort((a, b) => a.fieldName.localeCompare(b.fieldName));
    const lowConfidenceFields = fields.filter((f) => f.lowConfidence);
    const total = fields.length;
    const averageConfidence = total
      ? Math.round(fields.reduce((s, f) => s + f.confidence, 0) / total)
      : 0;

    const statistics: ConfidenceScoringStatistics = {
      totalFields: total,
      averageConfidence,
      highConfidenceCount: fields.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD).length,
      lowConfidenceCount: lowConfidenceFields.length,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
      processingTimeMs: Date.now() - started,
    };

    console.log('[ConfidenceScoring] Complete', statistics);

    return { fields, lowConfidenceFields, statistics };
  }

  private buildReason(breakdown: ConfidenceScoreBreakdown, score: number): string {
    const parts = [breakdown.baseBand, `score=${score}`];
    if (breakdown.validated) parts.push('validated');
    if (breakdown.aiVerified) parts.push(`AI verified (${breakdown.aiConfidence}%)`);
    if (breakdown.adjustments.length) parts.push(breakdown.adjustments.join('; '));
    return parts.join(' · ');
  }
}

export const confidenceScoringEngine = new ConfidenceScoringEngine();
