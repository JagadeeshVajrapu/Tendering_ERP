import { Types } from 'mongoose';
import { DocumentNitExtractedField } from '../../models/DocumentNitExtractedField';
import { DocumentFieldValidation } from '../../models/DocumentFieldValidation';
import { DocumentOpenAiVerification } from '../../models/DocumentOpenAiVerification';
import { DocumentFieldConfidence } from '../../models/DocumentFieldConfidence';
import {
  ConfidenceScoringInput,
  ConfidenceScoringResult,
} from '../../types/confidenceScoring';
import { confidenceScoringEngine } from './confidenceScoringEngine';

export interface ConfidenceStoreContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class ConfidenceScoringService {
  buildInputsFromRecords(
    extracted: Array<{
      fieldName: string;
      extractedValue: string;
      sourcePage: number;
      sourceText: string;
      extractionMethod?: string;
    }>,
    validations: Array<{
      fieldName: string;
      value: string;
      valid: boolean;
      reason?: string;
    }>,
    aiVerifications: Array<{
      fieldName: string;
      extractedValue?: string;
      verifiedValue: string;
      confidence: number;
      sourcePage?: number;
      sourceText?: string;
      correctness?: string;
      filledMissing?: boolean;
    }>
  ): ConfidenceScoringInput[] {
    const validationByField = new Map(validations.map((v) => [v.fieldName, v]));
    const aiByField = new Map(aiVerifications.map((v) => [v.fieldName, v]));
    const extractedNames = new Set(extracted.map((e) => e.fieldName));
    const inputs: ConfidenceScoringInput[] = [];

    for (const field of extracted) {
      const validation = validationByField.get(field.fieldName);
      const ai = aiByField.get(field.fieldName);
      inputs.push({
        fieldName: field.fieldName,
        extractedValue: field.extractedValue,
        sourceText: field.sourceText,
        sourcePage: field.sourcePage,
        extractionMethod: field.extractionMethod as ConfidenceScoringInput['extractionMethod'],
        validationResult: validation
          ? { valid: validation.valid, value: validation.value, reason: validation.reason }
          : undefined,
        aiVerificationResult: ai
          ? {
              verifiedValue: ai.verifiedValue,
              confidence: ai.confidence,
              filledMissing: ai.filledMissing,
              correctness: ai.correctness as 'correct' | 'incorrect' | 'uncertain' | undefined,
            }
          : undefined,
      });
    }

    for (const ai of aiVerifications) {
      if (extractedNames.has(ai.fieldName)) continue;
      inputs.push({
        fieldName: ai.fieldName,
        extractedValue: ai.extractedValue || '',
        sourceText: ai.sourceText || '',
        sourcePage: ai.sourcePage || 0,
        extractionMethod: 'ai_inferred',
        validationResult: validationByField.get(ai.fieldName)
          ? {
              valid: validationByField.get(ai.fieldName)!.valid,
              value: validationByField.get(ai.fieldName)!.value,
              reason: validationByField.get(ai.fieldName)!.reason,
            }
          : undefined,
        aiVerificationResult: {
          verifiedValue: ai.verifiedValue,
          confidence: ai.confidence,
          filledMissing: true,
          correctness: ai.correctness as 'correct' | 'incorrect' | 'uncertain' | undefined,
        },
      });
    }

    return inputs;
  }

  async loadAndBuildInputs(documentId: Types.ObjectId): Promise<ConfidenceScoringInput[]> {
    const [extracted, validations, aiVerifications] = await Promise.all([
      DocumentNitExtractedField.find({ documentId }).sort({ fieldName: 1 }),
      DocumentFieldValidation.find({ documentId }).sort({ fieldName: 1 }),
      DocumentOpenAiVerification.find({ documentId }).sort({ fieldName: 1 }),
    ]);

    return this.buildInputsFromRecords(
      extracted.map((e) => ({
        fieldName: e.fieldName,
        extractedValue: e.extractedValue,
        sourcePage: e.sourcePage,
        sourceText: e.sourceText,
        extractionMethod: e.extractionMethod,
      })),
      validations.map((v) => ({
        fieldName: v.fieldName,
        value: v.value,
        valid: v.valid,
        reason: v.reason,
      })),
      aiVerifications.map((v) => ({
        fieldName: v.fieldName,
        extractedValue: v.extractedValue,
        verifiedValue: v.verifiedValue,
        confidence: v.confidence,
        sourcePage: v.sourcePage,
        sourceText: v.sourceText,
        correctness: v.correctness,
        filledMissing: v.filledMissing,
      }))
    );
  }

  score(inputs: ConfidenceScoringInput[]): ConfidenceScoringResult {
    console.log('[ConfidenceScoring] Start', { fields: inputs.length });
    return confidenceScoringEngine.scoreAll(inputs);
  }

  async scoreAndStore(
    inputs: ConfidenceScoringInput[],
    ctx: ConfidenceStoreContext
  ): Promise<ConfidenceScoringResult> {
    const result = this.score(inputs);
    await this.saveResults(ctx, result);
    return result;
  }

  async scoreDocumentAndStore(ctx: ConfidenceStoreContext): Promise<ConfidenceScoringResult> {
    const inputs = await this.loadAndBuildInputs(ctx.documentId);
    if (!inputs.length) {
      throw new Error('No extracted fields available for confidence scoring');
    }
    return this.scoreAndStore(inputs, ctx);
  }

  async saveResults(ctx: ConfidenceStoreContext, result: ConfidenceScoringResult): Promise<void> {
    await DocumentFieldConfidence.deleteMany({ documentId: ctx.documentId });
    if (!result.fields.length) return;

    await DocumentFieldConfidence.insertMany(
      result.fields.map((f) => ({
        documentId: ctx.documentId,
        tenderId: ctx.tenderId,
        jobId: ctx.jobId,
        fieldName: f.fieldName,
        value: f.value,
        confidence: f.confidence,
        confidenceReason: f.confidenceReason,
        sourcePage: f.sourcePage,
        sourceText: f.sourceText,
        lowConfidence: f.lowConfidence,
        extractionMethod: f.breakdown.extractionMethod,
        breakdown: f.breakdown,
      }))
    );
  }

  async getStoredScores(documentId: Types.ObjectId) {
    return DocumentFieldConfidence.find({ documentId }).sort({ confidence: 1, fieldName: 1 });
  }
}

export const confidenceScoringService = new ConfidenceScoringService();
