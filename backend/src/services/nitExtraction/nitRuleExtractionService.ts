import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import { IExtractionRule } from '../../models/ExtractionRule';
import { DocumentNitExtractedField } from '../../models/DocumentNitExtractedField';
import {
  buildRulesForNITExtraction,
  nitRuleExtractionEngine,
  NitRulesDebugResult,
} from './nitRuleExtractionEngine';

export interface NitRuleStoreContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class NitRuleExtractionService {
  extract(pages: PageText[], dbRules: IExtractionRule[]): NitRulesDebugResult {
    const rules = buildRulesForNITExtraction(dbRules);
    return nitRuleExtractionEngine.extractFromOcrPages(pages, rules);
  }

  async extractAndStore(
    pages: PageText[],
    dbRules: IExtractionRule[],
    ctx: NitRuleStoreContext
  ): Promise<NitRulesDebugResult> {
    const started = Date.now();
    console.log('[NitRuleExtraction] Start', { pages: pages.length, rules: dbRules.length });

    const result = this.extract(pages, dbRules);
    await this.saveExtractedFields(ctx, result);

    console.log('[NitRuleExtraction] End', {
      successfulMatches: result.successfulMatches.length,
      failedMatches: result.failedMatches.length,
      extractedFields: result.extractedFields.length,
      processingTimeMs: Date.now() - started,
    });

    return result;
  }

  async saveExtractedFields(ctx: NitRuleStoreContext, result: NitRulesDebugResult): Promise<void> {
    await DocumentNitExtractedField.deleteMany({ documentId: ctx.documentId });
    if (!result.extractedFields.length) return;

    await DocumentNitExtractedField.insertMany(
      result.extractedFields.map((f) => ({
        documentId: ctx.documentId,
        tenderId: ctx.tenderId,
        jobId: ctx.jobId,
        fieldName: f.fieldName,
        extractedValue: f.extractedValue,
        sourcePage: f.sourcePage,
        sourceText: f.sourceText,
        extractionMethod: f.extractionMethod,
      }))
    );
  }

  async getStoredFields(documentId: Types.ObjectId) {
    return DocumentNitExtractedField.find({ documentId }).sort({ fieldName: 1 });
  }
}

export const nitRuleExtractionService = new NitRuleExtractionService();
