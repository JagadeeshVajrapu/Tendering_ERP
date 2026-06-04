import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { TenderDocument } from '../models/TenderDocument';
import { DocumentPage } from '../models/DocumentPage';
import { IntelligenceJob } from '../models/IntelligenceJob';
import { DocumentChunk, ChunkExtraction } from '../models/DocumentChunk';
import { TenderIntelligence } from '../models/TenderIntelligence';
import { TenderExtraction } from '../models/TenderExtraction';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import fs from 'fs/promises';
import { fileStorageService } from '../services/storage/fileStorageService';
import { pageExtractionService } from '../services/intelligence/pageExtractionService';
import { env } from '../config/env';
import { ExtractionRule } from '../models/ExtractionRule';
import { buildRulesForNITExtraction } from '../services/nitExtraction/nitRuleExtractionEngine';
import { nitRuleExtractionService } from '../services/nitExtraction/nitRuleExtractionService';
import { documentPageService } from '../services/ocr/documentPageService';
import { assertOcrQuality, buildOcrQualityMetricsFromPages } from '../services/ocr/ocrQualityMetrics';
import { candidateDetectionService } from '../services/candidateDetection/candidateDetectionService';
import { DocumentFieldCandidate } from '../models/DocumentFieldCandidate';
import { DocumentNitExtractedField } from '../models/DocumentNitExtractedField';
import { DocumentFieldValidation } from '../models/DocumentFieldValidation';
import { fieldValidationService } from '../services/validation/fieldValidationService';
import { openAiVerificationService } from '../services/ai/openAiVerificationService';
import { DocumentOpenAiVerification } from '../models/DocumentOpenAiVerification';
import { confidenceScoringService } from '../services/confidence/confidenceScoringService';
import { DocumentFieldConfidence } from '../models/DocumentFieldConfidence';
import { LOW_CONFIDENCE_THRESHOLD } from '../types/confidenceScoring';

function truncate(text: string, max = 6000): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...truncated ${text.length - max} chars]`;
}

export const getDocumentDebug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  const pages = await DocumentPage.find({ documentId: new Types.ObjectId(documentId) }).sort({ pageNumber: 1 });
  const pageTexts = documentPageService.toPageText(pages);

  const job = await IntelligenceJob.findOne({ documentId: new Types.ObjectId(documentId) }).sort({ createdAt: -1 });

  const chunks = job
    ? await DocumentChunk.find({ jobId: job._id }).sort({ chunkNumber: 1 })
    : [];

  const chunkExtractions = job
    ? await ChunkExtraction.find({ jobId: job._id }).sort({ chunkNumber: 1, pass: 1 })
    : [];

  const intelligence = job
    ? await TenderIntelligence.findOne({ jobId: job._id, phase: 'complete' }).sort({ createdAt: -1 })
    : null;

  const tenderExtraction = await TenderExtraction.findOne({ documentId: new Types.ObjectId(documentId) }).sort({
    createdAt: -1,
  });

  sendSuccess(res, {
    document: {
      id: String(document._id),
      tenderId: String(document.tenderId),
      originalName: document.originalName,
      mimeType: document.mimeType,
      pageCount: document.pageCount,
      s3Key: document.s3Key,
      s3Url: document.s3Url,
      createdAt: (document as any).createdAt,
    },
    ocrOutput: pageTexts.map((p) => ({
      pageNumber: p.pageNumber,
      extractionMethod: p.method,
      characterCount: p.charCount,
      extractedText: truncate(p.text, 7000),
    })),
    ocrQualityMetrics: document.ocrQualityMetrics || null,
    ocrDetectedType: document.ocrDetectedType || null,
    ocrExtractionMethod: document.ocrExtractionMethod || null,
    ocrProcessingTimeMs: document.ocrProcessingTimeMs || null,
    chunkStatistics: job?.chunkStatistics || null,
    chunks: chunks.map((c) => ({
      chunkNumber: c.chunkNumber,
      startPage: c.startPage,
      endPage: c.endPage,
      pageNumbers: c.pageNumbers,
      characterCount: c.characterCount ?? c.text.length,
      processingTimeMs: c.processingTimeMs ?? null,
      tablesExtracted: c.tablesExtracted ?? 0,
      status: c.status ?? 'pending',
      text: truncate(c.text, 12000),
    })),
    chunkExtractions: chunkExtractions.map((e) => ({
      chunkNumber: e.chunkNumber,
      pass: e.pass,
      aiModel: e.aiModel,
      tokensUsed: e.tokensUsed,
      fields: e.fields,
      rawJson: truncate(e.rawJson, 20000),
      createdAt: (e as any).createdAt,
    })),
    ruleMatches: (intelligence?.productionFields || []).map((f) => ({
      id: f.id,
      label: f.label,
      section: f.section,
      value: f.value,
      confidence: f.confidence,
      sourcePage: f.sourcePage,
      sourceText: truncate(f.sourceText || '', 2500),
      validated: f.validated,
      needsReview: f.needsReview,
    })),
    verifiedNit: intelligence?.verifiedNit || null,
    recommendation: intelligence?.recommendation || null,
    tenderExtraction: tenderExtraction
      ? {
          id: String(tenderExtraction._id),
          status: tenderExtraction.status,
          progress: tenderExtraction.progress,
          detectedFileType: tenderExtraction.detectedFileType,
          extractedFields: tenderExtraction.extractedFields,
          aiVerification: tenderExtraction.aiVerification || null,
          errorMessage: tenderExtraction.errorMessage || '',
        }
      : null,
  });
});

/** GET /api/debug/:documentId/ocr — per-page OCR text + quality metrics (verify before rule extraction). */
export const getDocumentOcr = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  let pages = await DocumentPage.find({ documentId: new Types.ObjectId(documentId) }).sort({ pageNumber: 1 });

  if (!pages.length && document.localPath) {
    const buffer = await fs.readFile(fileStorageService.getAbsolutePath(document.localPath));
    const { pages: extracted, ocr } = await pageExtractionService.extractPagesWithMetrics(
      buffer,
      document.mimeType,
      document.originalName,
      { bucket: env.aws.bucket, key: document.s3Key }
    );

    documentPageService.applyOcrMetadata(document, extracted, ocr);
    await documentPageService.savePages(document._id, document.tenderId, extracted);
    await document.save();

    pages = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
  }

  const pageTexts = documentPageService.toPageText(pages);

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    originalName: document.originalName,
    mimeType: document.mimeType,
    detectedType: document.ocrDetectedType || null,
    extractionMethod: document.ocrExtractionMethod || null,
    processingTimeMs: document.ocrProcessingTimeMs || null,
    qualityMetrics: document.ocrQualityMetrics || buildOcrQualityMetricsFromPages(pageTexts),
    pages: pageTexts.map((p) => ({
      pageNumber: p.pageNumber,
      extractedText: p.text,
      characterCount: p.charCount,
      extractionMethod: p.method,
    })),
  });
});

/** GET /api/debug/:documentId/rules — rule-based NIT extraction (exact/alias/regex/fuzzy, no AI). */
export const getDocumentRulesDebug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  let pages = await DocumentPage.find({ documentId: new Types.ObjectId(documentId) }).sort({ pageNumber: 1 });

  if (!pages.length) {
    if (!document.localPath) {
      throw new AppError('OCR pages not found. Re-upload the document to generate OCR.', 400);
    }

    const buffer = await fs.readFile(fileStorageService.getAbsolutePath(document.localPath));
    const { pages: extracted, ocr } = await pageExtractionService.extractPagesWithMetrics(
      buffer,
      document.mimeType,
      document.originalName,
      { bucket: env.aws.bucket, key: document.s3Key }
    );

    documentPageService.applyOcrMetadata(document, extracted, ocr);
    await documentPageService.savePages(document._id, document.tenderId, extracted);
    await document.save();

    pages = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
  }

  const ocrPages = documentPageService.toPageText(pages);
  assertOcrQuality(document.ocrQualityMetrics || buildOcrQualityMetricsFromPages(ocrPages));

  const dbRules = await ExtractionRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 });
  const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });

  const result = await nitRuleExtractionService.extractAndStore(ocrPages, dbRules, {
    documentId: document._id,
    tenderId: document.tenderId,
    jobId: job?._id,
  });

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    originalName: document.originalName,
    rulesEvaluated: buildRulesForNITExtraction(dbRules).length,
    matchMethods: ['exact', 'alias', 'regex', 'fuzzy'],
    successfulMatches: result.successfulMatches,
    failedMatches: result.failedMatches,
    extractedFields: result.extractedFields,
  });
});

/** GET /api/debug/:documentId/candidates — all detected field candidates before rule extraction. */
export const getDocumentCandidates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  let stored = await DocumentFieldCandidate.find({ documentId: new Types.ObjectId(documentId) }).sort({
    fieldName: 1,
    sourcePage: 1,
  });

  let statistics = null;

  if (!stored.length) {
    const pages = await DocumentPage.find({ documentId: new Types.ObjectId(documentId) }).sort({
      pageNumber: 1,
    });
    if (!pages.length) {
      throw new AppError('OCR pages not found. Run OCR before candidate detection.', 400);
    }

    const pageTexts = documentPageService.toPageText(pages);
    const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });
    const result = await candidateDetectionService.detectAndStore(pageTexts, {
      documentId: document._id,
      tenderId: document.tenderId,
      jobId: job?._id,
    });
    statistics = result.statistics;
    stored = await DocumentFieldCandidate.find({ documentId: document._id }).sort({
      fieldName: 1,
      sourcePage: 1,
    });
  }

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    originalName: document.originalName,
    statistics,
    candidates: stored.map((c) => ({
      fieldName: c.fieldName,
      candidateValue: c.candidateValue,
      sourcePage: c.sourcePage,
      sourceText: c.sourceText,
      detectionMethod: c.detectionMethod,
      confidence: c.confidence ?? null,
    })),
  });
});

/** GET /api/debug/:documentId/validation — validate & normalize extracted field values. */
export const getDocumentValidation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  let stored = await DocumentFieldValidation.find({ documentId: new Types.ObjectId(documentId) }).sort({
    fieldName: 1,
  });

  let statistics = null;

  if (!stored.length) {
    const extracted = await DocumentNitExtractedField.find({
      documentId: new Types.ObjectId(documentId),
    }).sort({ fieldName: 1 });

    if (!extracted.length) {
      throw new AppError('No extracted fields found. Run rule extraction first.', 400);
    }

    const candidates = await DocumentFieldCandidate.find({
      documentId: new Types.ObjectId(documentId),
    });
    const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });

    const result = await fieldValidationService.validateAndStore(
      extracted.map((f) => ({
        fieldName: f.fieldName,
        extractedValue: f.extractedValue,
      })),
      {
        documentId: document._id,
        tenderId: document.tenderId,
        jobId: job?._id,
      },
      candidates.map((c) => ({
        fieldName: c.fieldName,
        candidateValue: c.candidateValue,
      }))
    );

    statistics = result.statistics;
    stored = await DocumentFieldValidation.find({ documentId: document._id }).sort({ fieldName: 1 });
  }

  const validations = stored.map((v) => ({
    fieldName: v.fieldName,
    value: v.value,
    valid: v.valid,
    reason: v.reason,
    rawValue: v.rawValue || null,
    validationType: v.validationType || null,
  }));

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    originalName: document.originalName,
    statistics: statistics || {
      totalFields: validations.length,
      validCount: validations.filter((v) => v.valid).length,
      invalidCount: validations.filter((v) => !v.valid).length,
    },
    supportedTypes: ['date', 'currency', 'email', 'phone', 'tenderNumber'],
    normalizations: {
      date: 'YYYY-MM-DD',
      currency: 'numeric (INR rupees)',
    },
    validations,
    validFields: validations.filter((v) => v.valid),
    invalidFields: validations.filter((v) => !v.valid),
  });
});

/** GET /api/debug/:documentId/openai — GPT-4o per-field verification (no full OCR). */
export const getDocumentOpenAi = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  if (!env.openai.apiKey || !env.openai.enabled) {
    throw new AppError('OpenAI is not configured. Set OPENAI_API_KEY and OPENAI_ENABLED=true.', 500);
  }

  let stored = await DocumentOpenAiVerification.find({ documentId: new Types.ObjectId(documentId) }).sort({
    fieldName: 1,
  });

  let statistics = null;
  let missingFieldsFilled: string[] = [];

  if (!stored.length) {
    const extracted = await DocumentNitExtractedField.find({
      documentId: new Types.ObjectId(documentId),
    }).sort({ fieldName: 1 });

    if (!extracted.length) {
      throw new AppError('No extracted fields found. Run rule extraction first.', 400);
    }

    const candidates = await DocumentFieldCandidate.find({
      documentId: new Types.ObjectId(documentId),
    });
    const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });

    const result = await openAiVerificationService.verifyAndStore(
      extracted.map((f) => ({
        fieldName: f.fieldName,
        extractedValue: f.extractedValue,
        sourcePage: f.sourcePage,
        sourceText: f.sourceText,
      })),
      {
        documentId: document._id,
        tenderId: document.tenderId,
        jobId: job?._id,
      },
      candidates.map((c) => ({
        fieldName: c.fieldName,
        extractedValue: c.candidateValue,
        sourcePage: c.sourcePage,
        sourceText: c.sourceText,
      }))
    );

    statistics = result.statistics;
    missingFieldsFilled = result.missingFieldsFilled;
    stored = await DocumentOpenAiVerification.find({ documentId: document._id }).sort({ fieldName: 1 });
  }

  const verifiedFields = stored.map((v) => ({
    fieldName: v.fieldName,
    verifiedValue: v.verifiedValue,
    confidence: v.confidence,
    extractedValue: v.extractedValue,
    sourcePage: v.sourcePage ?? null,
    sourceText: v.sourceText || null,
    correctness: v.correctness || null,
    filledMissing: v.filledMissing || false,
    processingTimeMs: v.processingTimeMs ?? null,
  }));

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    originalName: document.originalName,
    model: 'gpt-4o',
    perFieldOnly: true,
    requestShape: ['fieldName', 'extractedValue', 'sourcePage', 'sourceText'],
    statistics: statistics || {
      totalFields: verifiedFields.length,
      verifiedCount: verifiedFields.filter((v) => v.confidence >= 70).length,
      model: 'gpt-4o',
    },
    missingFieldsFilled,
    verifiedFields: verifiedFields.map((v) => ({
      fieldName: v.fieldName,
      verifiedValue: v.verifiedValue,
      confidence: v.confidence,
    })),
    details: verifiedFields,
  });
});

/** GET /api/debug/:documentId/confidence — production confidence scores per field. */
export const getDocumentConfidence = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);

  const document = await TenderDocument.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  let stored = await DocumentFieldConfidence.find({ documentId: new Types.ObjectId(documentId) }).sort({
    confidence: 1,
    fieldName: 1,
  });

  let statistics = null;

  if (!stored.length) {
    const extracted = await DocumentNitExtractedField.find({ documentId: document._id });
    if (!extracted.length) {
      throw new AppError('No extracted fields found. Run rule extraction first.', 400);
    }

    const job = await IntelligenceJob.findOne({ documentId: document._id }).sort({ createdAt: -1 });
    const result = await confidenceScoringService.scoreDocumentAndStore({
      documentId: document._id,
      tenderId: document.tenderId,
      jobId: job?._id,
    });

    statistics = result.statistics;
    stored = await DocumentFieldConfidence.find({ documentId: document._id }).sort({
      confidence: 1,
      fieldName: 1,
    });
  }

  const fields = stored.map((f) => ({
    fieldName: f.fieldName,
    value: f.value,
    confidence: f.confidence,
    confidenceReason: f.confidenceReason,
    sourcePage: f.sourcePage,
    sourceText: f.sourceText,
    lowConfidence: f.lowConfidence,
    breakdown: f.breakdown || null,
  }));

  const lowConfidenceFields = fields.filter((f) => f.confidence < LOW_CONFIDENCE_THRESHOLD);

  sendSuccess(res, {
    documentId: String(document._id),
    tenderId: String(document.tenderId),
    originalName: document.originalName,
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    statistics: statistics || {
      totalFields: fields.length,
      averageConfidence: fields.length
        ? Math.round(fields.reduce((s, f) => s + f.confidence, 0) / fields.length)
        : 0,
      highConfidenceCount: fields.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD).length,
      lowConfidenceCount: lowConfidenceFields.length,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    },
    scoringLogic: {
      exactValidatedAiVerified: '95-100',
      regexValidatedAiVerified: '90-95',
      aliasValidatedAiVerified: '85-90',
      fuzzyValidated: '75-85',
      aiInferred: '60-75',
    },
    fields,
    lowConfidenceFields,
    highConfidenceFields: fields.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD),
  });
});

