import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { DocumentOpenAiVerification } from '../../models/DocumentOpenAiVerification';
import {
  OpenAiVerificationResult,
  OpenAiVerificationStatistics,
  OpenAiVerifiedField,
} from '../../types/openAiVerification';
import { gpt4oFieldVerificationService } from './gpt4oFieldVerificationService';
import { OPENAI_VERIFICATION_FIELDS } from './openAiVerificationFields';
import { mapWithConcurrency } from '../../utils/concurrency';

export interface FieldVerificationInput {
  fieldName: string;
  extractedValue: string;
  sourcePage: number;
  sourceText: string;
}

export interface OpenAiVerificationStoreContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class OpenAiVerificationService {
  async verifyFields(
    fields: FieldVerificationInput[],
    candidates?: FieldVerificationInput[]
  ): Promise<OpenAiVerificationResult> {
    if (!env.openai.apiKey || !env.openai.enabled) {
      throw new AppError('OpenAI is not configured. Set OPENAI_API_KEY and OPENAI_ENABLED=true.', 500);
    }

    const pipelineStarted = Date.now();
    console.log('[OpenAI] Verification Start', {
      model: 'gpt-4o',
      extractedFields: fields.length,
      perFieldOnly: true,
    });

    const verifiedFields: OpenAiVerifiedField[] = [];
    const verifiedNames = new Set<string>();
    let correctedCount = 0;
    let filledMissingCount = 0;
    let failedCount = 0;

    const concurrency = Math.max(1, env.intelligence.fieldConcurrency || 4);

    const extractedResults = await mapWithConcurrency(fields, concurrency, async (field) =>
      this.verifyOne(field, false)
    );

    for (const result of extractedResults) {
      if (!result) {
        failedCount++;
        continue;
      }
      verifiedFields.push(result.record);
      verifiedNames.add(result.record.fieldName);
      if (result.corrected) correctedCount++;
      if (result.record.confidence < 40) failedCount++;
    }

    const missingFieldsFilled: string[] = [];
    const candidateByField = new Map<string, FieldVerificationInput>();
    for (const c of candidates || []) {
      if (!candidateByField.has(c.fieldName)) {
        candidateByField.set(c.fieldName, c);
      }
    }

    const toFill = OPENAI_VERIFICATION_FIELDS.filter(
      (name) => !verifiedNames.has(name) && candidateByField.has(name)
    );

    const fillResults = await mapWithConcurrency(toFill, concurrency, async (fieldName) => {
      const candidate = candidateByField.get(fieldName)!;
      return this.verifyOne(
        {
          fieldName,
          extractedValue: candidate.extractedValue || '',
          sourcePage: candidate.sourcePage,
          sourceText: candidate.sourceText,
        },
        true
      );
    });

    for (const result of fillResults) {
      if (!result?.record.verifiedValue || result.record.confidence < 50) continue;
      verifiedFields.push({ ...result.record, filledMissing: true });
      verifiedNames.add(result.record.fieldName);
      missingFieldsFilled.push(result.record.fieldName);
      filledMissingCount++;
    }

    const statistics: OpenAiVerificationStatistics = {
      totalFields: verifiedFields.length,
      verifiedCount: verifiedFields.filter((v) => v.confidence >= 70).length,
      correctedCount,
      filledMissingCount,
      failedCount,
      totalProcessingTimeMs: Date.now() - pipelineStarted,
      model: 'gpt-4o',
    };

    console.log('[OpenAI] Verification End', statistics);

    return {
      verifiedFields: verifiedFields.sort((a, b) => a.fieldName.localeCompare(b.fieldName)),
      missingFieldsFilled,
      statistics,
    };
  }

  async verifyAndStore(
    fields: FieldVerificationInput[],
    ctx: OpenAiVerificationStoreContext,
    candidates?: FieldVerificationInput[]
  ): Promise<OpenAiVerificationResult> {
    const result = await this.verifyFields(fields, candidates);
    await this.saveResults(ctx, result.verifiedFields);
    return result;
  }

  async saveResults(ctx: OpenAiVerificationStoreContext, verified: OpenAiVerifiedField[]): Promise<void> {
    await DocumentOpenAiVerification.deleteMany({ documentId: ctx.documentId });
    if (!verified.length) return;

    await DocumentOpenAiVerification.insertMany(
      verified.map((v) => ({
        documentId: ctx.documentId,
        tenderId: ctx.tenderId,
        jobId: ctx.jobId,
        fieldName: v.fieldName,
        extractedValue: v.extractedValue || '',
        verifiedValue: v.verifiedValue,
        confidence: v.confidence,
        sourcePage: v.sourcePage,
        sourceText: v.sourceText || '',
        correctness: v.correctness,
        filledMissing: v.filledMissing || false,
        processingTimeMs: v.processingTimeMs,
        aiModel: 'gpt-4o',
      }))
    );
  }

  async getStoredVerifications(documentId: Types.ObjectId) {
    return DocumentOpenAiVerification.find({ documentId }).sort({ fieldName: 1 });
  }

  private async verifyOne(
    field: FieldVerificationInput,
    filledMissing: boolean
  ): Promise<{ record: OpenAiVerifiedField; corrected: boolean } | null> {
    const started = Date.now();
    const out = await gpt4oFieldVerificationService.verifyField({
      fieldName: field.fieldName,
      extractedValue: field.extractedValue,
      sourcePage: field.sourcePage,
      sourceText: field.sourceText,
    });

    const processingTimeMs = Date.now() - started;
    console.log('[OpenAI] Processing Time', {
      fieldName: field.fieldName,
      processingTimeMs,
      filledMissing,
    });

    if (!out) return null;

    const corrected =
      out.verifiedValue.trim() !== field.extractedValue.trim() &&
      out.confidence >= 70 &&
      out.verifiedValue.trim().length > 0;

    return {
      corrected,
      record: {
        fieldName: out.fieldName,
        verifiedValue: out.verifiedValue,
        confidence: out.confidence,
        extractedValue: field.extractedValue,
        sourcePage: field.sourcePage,
        sourceText: field.sourceText,
        correctness: out.correctness,
        filledMissing,
        processingTimeMs,
      },
    };
  }
}

export const openAiVerificationService = new OpenAiVerificationService();
