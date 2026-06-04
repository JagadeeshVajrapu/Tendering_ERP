import { Types } from 'mongoose';
import {
  FieldValidationRecord,
  FieldValidationResult,
  FieldValidationStatistics,
} from '../../types/fieldValidation';
import { DocumentFieldValidation } from '../../models/DocumentFieldValidation';
import { validateExtractedFields, enrichWithContactCandidates } from './fieldValidationMapper';

export interface FieldValidationStoreContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class FieldValidationService {
  validateFields(
    fields: Array<{ fieldName: string; extractedValue: string }>,
    candidates?: Array<{ fieldName: string; candidateValue: string }>
  ): FieldValidationResult {
    const started = Date.now();
    let validations = validateExtractedFields(fields);
    if (candidates?.length) {
      validations = enrichWithContactCandidates(validations, candidates);
    }
    return {
      validations,
      statistics: this.buildStatistics(validations, started),
    };
  }

  async validateAndStore(
    fields: Array<{ fieldName: string; extractedValue: string }>,
    ctx: FieldValidationStoreContext,
    candidates?: Array<{ fieldName: string; candidateValue: string }>
  ): Promise<FieldValidationResult> {
    const started = Date.now();
    console.log('[FieldValidation] Start', { fields: fields.length });

    let validations = validateExtractedFields(fields);
    if (candidates?.length) {
      validations = enrichWithContactCandidates(validations, candidates);
    }
    await this.saveValidations(ctx, validations);

    const statistics = this.buildStatistics(validations, started);
    console.log('[FieldValidation] End', {
      totalFields: statistics.totalFields,
      validCount: statistics.validCount,
      invalidCount: statistics.invalidCount,
      processingTimeMs: statistics.processingTimeMs,
    });

    return { validations, statistics };
  }

  async saveValidations(ctx: FieldValidationStoreContext, validations: FieldValidationRecord[]): Promise<void> {
    await DocumentFieldValidation.deleteMany({ documentId: ctx.documentId });
    if (!validations.length) return;

    await DocumentFieldValidation.insertMany(
      validations.map((v) => ({
        documentId: ctx.documentId,
        tenderId: ctx.tenderId,
        jobId: ctx.jobId,
        fieldName: v.fieldName,
        value: v.value,
        valid: v.valid,
        reason: v.reason,
        rawValue: v.rawValue || '',
        validationType: v.validationType,
      }))
    );
  }

  async getStoredValidations(documentId: Types.ObjectId) {
    return DocumentFieldValidation.find({ documentId }).sort({ fieldName: 1 });
  }

  private buildStatistics(validations: FieldValidationRecord[], started: number): FieldValidationStatistics {
    const validCount = validations.filter((v) => v.valid).length;
    return {
      totalFields: validations.length,
      validCount,
      invalidCount: validations.length - validCount,
      processingTimeMs: Date.now() - started,
    };
  }
}

export const fieldValidationService = new FieldValidationService();
