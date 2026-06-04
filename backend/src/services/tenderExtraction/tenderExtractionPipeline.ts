import fs from 'fs/promises';
import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderExtraction } from '../../models/TenderExtraction';
import { jobStatusService } from '../jobs/jobStatusService';
import { env } from '../../config/env';
import { fileStorageService } from '../storage/fileStorageService';
import { textExtractionService } from './textExtractionService';
import { cleanExtractedText } from './textCleaner';
import { ruleEngineService } from './tenderRuleEngineService';
import { fieldValidationService } from './tenderValidationService';
import { aiVerificationService } from './verification/aiVerificationService';
import { TenderExtractionJobPayload } from '../../queues/types';

class TenderExtractionPipeline {
  async run(payload: TenderExtractionJobPayload): Promise<void> {
    const extraction = await TenderExtraction.findById(payload.extractionId);
    if (!extraction) throw new AppError('Extraction record not found', 404);

    await TenderExtraction.findByIdAndUpdate(extraction._id, {
      status: 'processing',
      progress: 5,
      errorMessage: '',
    });
    await jobStatusService.updateProgress(payload.queueJobId, 5, 'active');

    const doc = await TenderDocument.findById(payload.documentId);
    if (!doc) throw new AppError('Tender document not found', 404);

    const buffer = await this.readDocumentBuffer(doc);

    // Text extraction
    const s3 = env.aws.accessKeyId ? { key: doc.s3Key, bucket: env.aws.bucket } : undefined;
    const extracted = await textExtractionService.extract(buffer, doc.mimeType, doc.originalName, s3);

    await TenderExtraction.findByIdAndUpdate(extraction._id, {
      detectedFileType: extracted.detectedType,
      extractedText: extracted.extractedText,
      status: 'text_extracted',
      progress: 35,
    });
    await jobStatusService.updateProgress(payload.queueJobId, 35, 'active');

    // Cleaning
    const cleaned = cleanExtractedText(extracted.extractedText);
    await TenderExtraction.findByIdAndUpdate(extraction._id, {
      cleanedText: cleaned.text,
      progress: 45,
    });
    await jobStatusService.updateProgress(payload.queueJobId, 45, 'active');

    // Rule engine extraction
    const rules = await ruleEngineService.getActiveRules();
    const ruleExtracted = ruleEngineService.extractFields(cleaned.text, rules);

    // Validation + normalization
    const validated = fieldValidationService.validateAndNormalize(ruleExtracted);

    await TenderExtraction.findByIdAndUpdate(extraction._id, {
      extractedFields: validated,
      status: 'rule_analysis_complete',
      progress: 70,
    });
    await jobStatusService.updateProgress(payload.queueJobId, 70, 'active');

    // AI verification
    const provider = payload.provider || (env.openai.apiKey && env.openai.enabled ? 'openai' : 'gemini');
    const afterAi = await aiVerificationService.verifyAndCorrect({
      provider,
      extractedFields: validated,
    });

    await TenderExtraction.findByIdAndUpdate(extraction._id, {
      extractedFields: afterAi.fields,
      aiVerification: afterAi.aiVerification,
      status: 'ai_verification_complete',
      progress: 100,
    });
    await jobStatusService.setCompleted(payload.queueJobId, { extractionId: String(extraction._id) });
  }

  private async readDocumentBuffer(doc: { localPath?: string; s3Key: string; originalName: string }) {
    if (doc.localPath) {
      const abs = fileStorageService.getAbsolutePath(doc.localPath);
      return fs.readFile(abs);
    }
    throw new AppError('Document not available locally for extraction. Ensure local storage is enabled.', 500);
  }
}

export const tenderExtractionPipeline = new TenderExtractionPipeline();

