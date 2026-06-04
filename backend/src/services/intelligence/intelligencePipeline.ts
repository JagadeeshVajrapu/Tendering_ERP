import fs from 'fs/promises';
import { Types } from 'mongoose';
import { IntelligenceJob } from '../../models/IntelligenceJob';
import { DocumentPage } from '../../models/DocumentPage';
import { DocumentLocatorField } from '../../models/DocumentLocatorField';
import { TenderIntelligence } from '../../models/TenderIntelligence';
import { TenderDocument } from '../../models/TenderDocument';
import { tenderRepository, tenderAnalysisRepository } from '../../repositories/tenderRepository';
import { TenderStatus } from '../../types';
import { MergedIntelligence } from '../../types/intelligence';
import { pageExtractionService } from './pageExtractionService';
import { consultantIntelligencePipeline } from './consultantIntelligencePipeline';
import { documentChunkProcessorService } from './documentChunkProcessorService';
import { tenderVerificationOrchestrator } from './tenderVerificationOrchestrator';
import { verifiedNitJsonBuilder } from './verifiedNitJsonBuilder';
import { nitTableBuilder } from './nitTableBuilder';
import { buildConsultantExecutiveSummaries } from './consultantExecutiveOutputs';
import { env } from '../../config/env';
import { fileStorageService } from '../storage/fileStorageService';
import { ITenderAnalysisData } from '../../models/TenderAnalysis';
import { getWorkflowIoEmitter } from '../workflow/workflowService';
import { jobStatusService, mapInternalToQueueStatus } from '../jobs/jobStatusService';
import { pipelineCacheService } from '../cache/pipelineCacheService';
import { PipelineTimer } from '../../utils/pipelineTimer';
import { documentPageService } from '../ocr/documentPageService';
import {
  assertOcrQuality,
  buildOcrQualityMetricsFromPages,
  OCR_QUALITY_TOO_LOW,
} from '../ocr/ocrQualityMetrics';
import { candidateDetectionService } from '../candidateDetection/candidateDetectionService';
import { nitRuleExtractionService } from '../nitExtraction/nitRuleExtractionService';
import { fieldValidationService } from '../validation/fieldValidationService';
import { openAiVerificationService } from '../ai/openAiVerificationService';
import { confidenceScoringService } from '../confidence/confidenceScoringService';
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { tenderProductionPipeline } from '../production/tenderProductionPipeline';
import { TenderMasterDataset } from '../../models/TenderMasterDataset';
import { tenderRiskAnalysisService } from '../risk/tenderRiskAnalysisService';
import { tenderExecutiveRecommendationService } from '../recommendation/tenderExecutiveRecommendationService';
import { ExtractionRule } from '../../models/ExtractionRule';

export interface IntelligenceJobPayload {
  jobId: string;
  queueJobId?: string;
  tenderId: string;
  documentId: string;
  userId: string;
}

function mergedToLegacyAnalysis(merged: MergedIntelligence): ITenderAnalysisData {
  const get = (key: keyof MergedIntelligence) => {
    const v = merged[key]?.value;
    if (!v) return '';
    return Array.isArray(v) ? v.join(', ') : String(v);
  };
  const list = (key: keyof MergedIntelligence) => {
    const v = merged[key]?.value;
    if (!v) return [];
    return Array.isArray(v) ? v.map(String) : [String(v)];
  };

  return {
    tenderName: get('tenderName'),
    department: get('department'),
    organization: get('organization') || get('issuingAuthority'),
    tenderNumber: get('tenderNumber') || get('tenderReferenceNumber'),
    estimatedValue: get('estimatedTenderValue'),
    emdAmount: get('emdAmount'),
    bgRequirement: get('bankGuarantee') || get('performanceSecurity'),
    bidSubmissionDate: get('bidSubmissionDate'),
    preBidMeetingDate: get('preBidMeetingDate'),
    contractDuration: get('contractDuration'),
    scopeOfWork: get('scopeOfWork'),
    eligibilityCriteria: list('eligibilityCriteria'),
    technicalRequirements: list('technicalRequirements'),
    reverseAuction: '',
    mafRequired: '',
    requiredDocuments: list('requiredDocuments'),
    importantDates: [],
    paymentTerms: get('paymentTerms'),
    riskFactors: list('risks'),
    aiRecommendation: 'Enterprise tender verification complete',
  };
}

class IntelligencePipeline {
  private emitProgress(
    tenderId: string,
    jobId: string,
    status: string,
    progress: number,
    queueJobId?: string,
    errorMessage?: string
  ) {
    const emitter = getWorkflowIoEmitter();
    emitter?.(tenderId, {
      type: 'intelligence:progress',
      jobId,
      status,
      progress,
      errorMessage,
    });
    emitter?.(tenderId, { type: 'tender:update', status, progress, errorMessage });

    if (queueJobId) {
      jobStatusService
        .updateProgress(queueJobId, progress, mapInternalToQueueStatus(status))
        .catch(console.error);
    }
  }

  private emitComplete(tenderId: string, jobId: string, intelligence: unknown, queueJobId?: string) {
    const emitter = getWorkflowIoEmitter();
    emitter?.(tenderId, {
      type: 'intelligence:complete',
      jobId,
      status: 'completed',
      progress: 100,
      intelligence,
    });
    emitter?.(tenderId, { type: 'tender:update', status: 'completed', progress: 100 });

    if (queueJobId) {
      jobStatusService.setCompleted(queueJobId).catch(console.error);
    }
  }

  private emitPreview(tenderId: string, jobId: string, progress: number, intelligence: unknown) {
    const emitter = getWorkflowIoEmitter();
    emitter?.(tenderId, {
      type: 'intelligence:preview',
      jobId,
      status: 'analyzing',
      progress,
      intelligence,
    });
    emitter?.(tenderId, { type: 'tender:update', status: 'analyzing', progress });
  }

  /**
   * Enterprise Tender Verification Pipeline (Stages 1–12).
   */
  async runAnalysis(payload: IntelligenceJobPayload): Promise<void> {
    const start = Date.now();
    const timer = new PipelineTimer();
    const job = await IntelligenceJob.findById(payload.jobId);
    if (!job) throw new Error('Intelligence job not found');

    const document = await TenderDocument.findById(payload.documentId);
    if (!document) throw new Error('Document not found');

    try {
      // Stage 1 — Document ingestion
      job.status = 'extracting_pages';
      job.progress = 8;
      job.startedAt = new Date();
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 8, payload.queueJobId);

      const buffer = await this.readDocumentBuffer(document);
      const contentHash = pipelineCacheService.hashBuffer(buffer);

      // OCR cache: MongoDB pages → Redis content hash → fresh extraction
      const cached = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
      let pages = documentPageService.toPageText(cached);
      let ocrMetrics = document.ocrQualityMetrics;

      if (!pages.length) {
        const redisPages = await pipelineCacheService.getOcrPages(contentHash);
        if (redisPages?.length) {
          pages = redisPages;
          ocrMetrics = buildOcrQualityMetricsFromPages(pages);
          console.log('[Pipeline] OCR cache hit (redis)', { pages: pages.length, contentHash: contentHash.slice(0, 12) });
        }
      }

      if (!pages.length) {
        const { pages: extracted, ocr } = await pageExtractionService.extractPagesWithMetrics(
          buffer,
          document.mimeType,
          document.originalName,
          { bucket: env.aws.bucket, key: document.s3Key }
        );
        pages = extracted;
        ocrMetrics = ocr.metrics;
        await pipelineCacheService.setOcrPages(contentHash, pages);
        documentPageService.applyOcrMetadata(document, pages, ocr);
      }

      if (!cached.length && pages.length) {
        await documentPageService.savePages(document._id, job.tenderId, pages);
      }

      if (!ocrMetrics) {
        ocrMetrics = buildOcrQualityMetricsFromPages(pages);
        document.ocrQualityMetrics = ocrMetrics;
      }

      assertOcrQuality(ocrMetrics);

      timer.mark('ocr');

      document.extractedText = pageExtractionService.getFullText(pages);
      document.pageCount = pages.length;
      await document.save();

      // Production path: Label-Value → Store → Map → Validate (canonical fields)
      job.status = 'analyzing';
      job.progress = 12;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 12, payload.queueJobId);

      const productionExtraction = await tenderProductionPipeline.run({
        documentId: document._id,
        tenderId: job.tenderId,
        jobId: job._id,
        pages,
      });
      console.log('[ProductionPipeline]', {
        steps: productionExtraction.steps,
        labelPairs: productionExtraction.labelValuePairCount,
        mapped: productionExtraction.mappedFieldCount,
        locatorFields: productionExtraction.locatorFieldCount,
        validation: productionExtraction.validation,
      });
      timer.mark('production_label_value_mapping');

      job.pageCount = pages.length;
      job.status = 'chunking';
      job.progress = 15;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 15, payload.queueJobId);

      const { chunks, artifacts: chunkArtifacts } = await documentChunkProcessorService.splitStoreAndProcess(
        pages,
        {
          documentId: document._id,
          tenderId: job.tenderId,
          jobId: job._id,
        }
      );

      job.chunkCount = chunkArtifacts.statistics.totalChunks;
      job.chunksProcessed = chunkArtifacts.statistics.chunksProcessed;
      job.chunkStatistics = chunkArtifacts.statistics;
      job.status = 'analyzing';
      job.progress = 25;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 25, payload.queueJobId);
      timer.mark('chunking');

      // Candidate detection — scan OCR before OpenAI / rule extraction
      job.status = 'analyzing';
      job.progress = 28;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 28, payload.queueJobId);

      const candidateResult = await candidateDetectionService.detectAndStore(pages, {
        documentId: document._id,
        tenderId: job.tenderId,
        jobId: job._id,
      });
      timer.mark('candidate_detection');

      const dbRules = await ExtractionRule.find({ active: true }).sort({ priority: -1, updatedAt: -1 });
      const nitRuleResult = await nitRuleExtractionService.extractAndStore(pages, dbRules, {
        documentId: document._id,
        tenderId: job.tenderId,
        jobId: job._id,
      });
      timer.mark('nit_rule_extraction');

      const locatorForValidation = await DocumentLocatorField.find({ documentId: document._id });
      const validationFieldMap = new Map<string, { fieldName: string; extractedValue: string }>();

      for (const f of nitRuleResult.extractedFields) {
        validationFieldMap.set(f.fieldName.toLowerCase(), {
          fieldName: f.fieldName,
          extractedValue: f.extractedValue,
        });
      }
      for (const f of locatorForValidation) {
        validationFieldMap.set(f.fieldName.toLowerCase(), {
          fieldName: f.fieldName,
          extractedValue: f.value,
        });
      }

      const validationResult = await fieldValidationService.validateAndStore(
        Array.from(validationFieldMap.values()),
        {
          documentId: document._id,
          tenderId: job.tenderId,
          jobId: job._id,
        },
        candidateResult.candidates.map((c) => ({
          fieldName: c.fieldName,
          candidateValue: c.candidateValue,
        }))
      );
      timer.mark('field_validation');

      let openAiVerificationResult = null;
      if (env.openai.apiKey && env.openai.enabled) {
        job.progress = 29;
        await job.save();
        openAiVerificationResult = await openAiVerificationService.verifyAndStore(
          nitRuleResult.extractedFields.map((f) => ({
            fieldName: f.fieldName,
            extractedValue: f.extractedValue,
            sourcePage: f.sourcePage,
            sourceText: f.sourceText,
          })),
          {
            documentId: document._id,
            tenderId: job.tenderId,
            jobId: job._id,
          },
          candidateResult.candidates.map((c) => ({
            fieldName: c.fieldName,
            extractedValue: c.candidateValue,
            sourcePage: c.sourcePage,
            sourceText: c.sourceText,
          }))
        );
        timer.mark('openai_verification');
      }

      const confidenceInputs = confidenceScoringService.buildInputsFromRecords(
        nitRuleResult.extractedFields.map((f) => ({
          fieldName: f.fieldName,
          extractedValue: f.extractedValue,
          sourcePage: f.sourcePage,
          sourceText: f.sourceText,
          extractionMethod: f.extractionMethod,
        })),
        validationResult.validations.map((v) => ({
          fieldName: v.fieldName,
          value: v.value,
          valid: v.valid,
          reason: v.reason,
        })),
        (openAiVerificationResult?.verifiedFields || []).map((v) => ({
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

      const confidenceResult = await confidenceScoringService.scoreAndStore(confidenceInputs, {
        documentId: document._id,
        tenderId: job.tenderId,
        jobId: job._id,
      });
      timer.mark('confidence_scoring');

      const masterDatasetResult = await masterDatasetService.buildAndStore({
        tenderId: job.tenderId,
        documentId: document._id,
        jobId: job._id,
      });
      timer.mark('master_dataset');

      const riskAnalysisResult = await tenderRiskAnalysisService.analyzeAndStore({
        tenderId: job.tenderId,
        documentId: document._id,
        jobId: job._id,
      });
      timer.mark('risk_analysis');

      const executiveRecommendationResult = await tenderExecutiveRecommendationService.generateAndStore({
        tenderId: job.tenderId,
        documentId: document._id,
        jobId: job._id,
      });
      timer.mark('executive_recommendation');

      // Consultant pipeline Steps 1–9 (no direct AI extraction)
      job.progress = 30;
      await IntelligenceJob.findByIdAndUpdate(job._id, { progress: 30, status: 'analyzing' });
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 30, payload.queueJobId);

      let lastProgressDbWrite = 0;
      const consultantResult = await consultantIntelligencePipeline.run(
        pages,
        async (fieldPct) => {
          const progress = 30 + Math.round((fieldPct / 100) * 42);
          job.progress = progress;
          job.status = 'analyzing';
          const now = Date.now();
          if (now - lastProgressDbWrite >= 400) {
            lastProgressDbWrite = now;
            await IntelligenceJob.findByIdAndUpdate(job._id, { progress, status: 'analyzing' });
          }
          this.emitProgress(payload.tenderId, payload.jobId, 'analyzing', progress, payload.queueJobId);
        },
        { chunkArtifacts }
      );
      await IntelligenceJob.findByIdAndUpdate(job._id, {
        progress: job.progress,
        status: 'analyzing',
      });

      const {
        productionFields,
        merged: validatedMerged,
        verifiedNit,
        nitTables,
        mdReport,
        summaries: finalSummaries,
        documentUnderstanding,
      } = consultantResult;
      const documentMap = documentUnderstanding.documentMap;
      timer.mark('consultant_pipeline');

      job.status = 'validating';
      job.progress = 78;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 78, payload.queueJobId);

      const previewPayload = {
        tenderId: job.tenderId,
        documentId: document._id,
        jobId: job._id,
        analyzedBy: new Types.ObjectId(payload.userId),
        pageCount: pages.length,
        chunkCount: chunkArtifacts.statistics.totalChunks,
        chunkStatistics: chunkArtifacts.statistics,
        candidateStatistics: candidateResult.statistics,
        nitRuleExtraction: {
          successfulMatches: nitRuleResult.successfulMatches.length,
          failedMatches: nitRuleResult.failedMatches.length,
          extractedFields: nitRuleResult.extractedFields,
        },
        fieldValidation: {
          totalFields: validationResult.statistics.totalFields,
          validCount: validationResult.statistics.validCount,
          invalidCount: validationResult.statistics.invalidCount,
          validations: validationResult.validations,
        },
        openAiVerification: openAiVerificationResult
          ? {
              model: openAiVerificationResult.statistics.model,
              verifiedFields: openAiVerificationResult.verifiedFields.map((v) => ({
                fieldName: v.fieldName,
                verifiedValue: v.verifiedValue,
                confidence: v.confidence,
              })),
              missingFieldsFilled: openAiVerificationResult.missingFieldsFilled,
              statistics: openAiVerificationResult.statistics,
            }
          : null,
        confidenceScoring: {
          averageConfidence: confidenceResult.statistics.averageConfidence,
          lowConfidenceCount: confidenceResult.statistics.lowConfidenceCount,
          lowConfidenceThreshold: confidenceResult.statistics.lowConfidenceThreshold,
          fields: confidenceResult.fields.map((f) => ({
            fieldName: f.fieldName,
            value: f.value,
            confidence: f.confidence,
            confidenceReason: f.confidenceReason,
            lowConfidence: f.lowConfidence,
          })),
          lowConfidenceFields: confidenceResult.lowConfidenceFields.map((f) => ({
            fieldName: f.fieldName,
            value: f.value,
            confidence: f.confidence,
            confidenceReason: f.confidenceReason,
          })),
        },
        masterDataset: {
          populatedFields: masterDatasetResult.statistics.populatedFields,
          averageConfidence: masterDatasetResult.statistics.averageConfidence,
          dataset: masterDatasetResult.dataset,
        },
        masterDatasetRiskAnalysis: {
          overallLevel: riskAnalysisResult.overallLevel,
          risks: riskAnalysisResult.risks,
        },
        executiveRecommendation: {
          recommendation: executiveRecommendationResult.recommendation,
          executiveSummary: executiveRecommendationResult.executiveSummary,
          dataQualityScore: executiveRecommendationResult.dataQualityScore,
        },
        phase: 'processing' as const,
        merged: validatedMerged,
        documentMap,
        verifiedNit,
        productionFields,
        nitTables,
        executiveBullets: finalSummaries.executiveBullets,
        mdReport,
        scopeSummary: finalSummaries.scopeSummary || '',
        eligibilitySummary: finalSummaries.eligibilitySummary || '',
        timelineSummary: finalSummaries.timelineSummary || '',
        financialSummary: finalSummaries.financialSummary || '',
        riskSummary: finalSummaries.riskSummary || '',
        riskAnalysis: {
          items: consultantResult.riskAnalysis.items,
          overallLevel: consultantResult.riskAnalysis.overallLevel,
          prerequisites: consultantResult.riskAnalysis.prerequisites,
          processingTimeMs: consultantResult.riskAnalysis.processingTimeMs,
        },
        recommendation: finalSummaries.recommendation,
        aiModel: 'consultant-intelligence-pipeline',
      };

      const preview = await TenderIntelligence.findOneAndUpdate(
        { tenderId: job.tenderId, jobId: job._id },
        { $set: previewPayload },
        { upsert: true, new: true }
      );
      this.emitPreview(payload.tenderId, payload.jobId, 78, preview.toObject());

      job.status = 'generating_report';
      job.progress = 90;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 90, payload.queueJobId);

      const intelligence = await TenderIntelligence.findOneAndUpdate(
        { tenderId: job.tenderId, jobId: job._id },
        {
          $set: {
            ...previewPayload,
            phase: 'complete',
            processingTimeMs: Date.now() - start,
          },
        },
        { new: true }
      );
      if (!intelligence) throw new Error('Failed to save intelligence results');

      const legacyData = mergedToLegacyAnalysis(validatedMerged);
      await tenderAnalysisRepository.create({
        tenderId: new Types.ObjectId(payload.tenderId),
        documentId: document._id,
        analyzedBy: new Types.ObjectId(payload.userId),
        ...legacyData,
        aiRecommendation: `${finalSummaries.recommendation} — verified extraction`,
        rawText: document.extractedText?.slice(0, 50000),
        aiModel: 'enterprise-verification-pipeline',
        processingTimeMs: Date.now() - start,
      });

      await tenderRepository.updateFromAnalysis(payload.tenderId, legacyData);
      await tenderRepository.setStatus(payload.tenderId, TenderStatus.NIT_ANALYZED, 'Analysis Complete');

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      await job.save();

      const totalMs = Date.now() - start;
      console.log('[Pipeline] Analysis complete', timer.summary({
        tenderId: payload.tenderId,
        documentId: payload.documentId,
        pageCount: pages.length,
        chunkCount: chunkArtifacts.statistics.totalChunks,
        chunkProcessingTimeMs: chunkArtifacts.statistics.totalProcessingTimeMs,
        totalMs,
        target50PageSec: 30,
        withinTarget: pages.length <= 50 && totalMs <= 30_000,
      }));

      this.emitComplete(payload.tenderId, payload.jobId, intelligence.toObject(), payload.queueJobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[IntelligencePipeline] Analysis error:', msg);

      if (msg === OCR_QUALITY_TOO_LOW) {
        job.status = 'failed';
        job.errorMessage = OCR_QUALITY_TOO_LOW;
        await job.save();
        this.emitProgress(
          payload.tenderId,
          payload.jobId,
          'failed',
          job.progress,
          payload.queueJobId,
          OCR_QUALITY_TOO_LOW
        );
        if (payload.queueJobId) {
          await jobStatusService.setFailed(payload.queueJobId, OCR_QUALITY_TOO_LOW);
        }
        throw err;
      }

      try {
        const pages = await DocumentPage.find({ documentId: document._id }).sort({ pageNumber: 1 });
        if (pages.length > 0) {
          const pageTexts = documentPageService.toPageText(pages);
          const verification = await tenderVerificationOrchestrator.runRuleAndVerificationPasses(pageTexts);
          if (verification.productionFields.length > 0) {
            await this.saveIntelligenceResult(
              payload,
              job,
              document,
              pageTexts,
              verification.merged,
              verification.productionFields,
              verification.documentMap,
              start,
              'Enterprise verification (recovery)'
            );
            return;
          }
        }
      } catch (recoveryErr) {
        console.error('[IntelligencePipeline] Recovery failed:', recoveryErr);
      }

      const masterReady = await TenderMasterDataset.exists({ documentId: document._id });
      if (masterReady) {
        job.status = 'completed';
        job.progress = 100;
        job.errorMessage = undefined;
        job.completedAt = new Date();
        await IntelligenceJob.findByIdAndUpdate(job._id, {
          status: 'completed',
          progress: 100,
          errorMessage: '',
          completedAt: job.completedAt,
        });
        await tenderRepository.setStatus(payload.tenderId, TenderStatus.NIT_ANALYZED, 'Analysis Complete');
        this.emitComplete(payload.tenderId, payload.jobId, { phase: 'complete' }, payload.queueJobId);
        console.log('[IntelligencePipeline] Marked complete — master dataset available despite consultant error');
        return;
      }

      job.status = 'failed';
      job.errorMessage = msg.includes('quota')
        ? 'OpenAI quota exceeded. Re-analyze after adding credits, or disable AI verification in env.'
        : msg;
      await job.save();
      this.emitProgress(
        payload.tenderId,
        payload.jobId,
        'failed',
        job.progress,
        payload.queueJobId,
        job.errorMessage
      );
      if (payload.queueJobId) {
        await jobStatusService.setFailed(payload.queueJobId, job.errorMessage || 'Analysis failed');
      }
      throw err;
    }
  }

  private async saveIntelligenceResult(
    payload: IntelligenceJobPayload,
    job: import('../../models/IntelligenceJob').IIntelligenceJob,
    document: import('../../models/TenderDocument').ITenderDocument,
    pages: import('../../types/intelligence').PageText[],
    merged: MergedIntelligence,
    productionFields: import('./extractedProductionField').ExtractedProductionField[],
    documentMap: import('./documentMapBuilder').DocumentMap,
    start: number,
    aiNote: string
  ): Promise<void> {
    const verifiedNit = verifiedNitJsonBuilder.build(productionFields);
    const finalSummaries = buildConsultantExecutiveSummaries(productionFields, verifiedNit);
    const nitTables = nitTableBuilder.build(
      merged,
      finalSummaries.recommendation,
      productionFields,
      verifiedNit
    );
    const mdReport = nitTableBuilder.buildMdReport(
      productionFields,
      merged,
      finalSummaries.recommendation
    );

    await TenderIntelligence.deleteMany({ tenderId: job.tenderId, jobId: job._id });

    const intelligence = await TenderIntelligence.create({
      tenderId: job.tenderId,
      documentId: document._id,
      jobId: job._id,
      analyzedBy: new Types.ObjectId(payload.userId),
      pageCount: pages.length,
      chunkCount: Math.ceil(pages.length / 5),
      phase: 'complete',
      merged,
      documentMap,
      verifiedNit,
      productionFields,
      nitTables,
      executiveBullets: finalSummaries.executiveBullets,
      mdReport,
      scopeSummary: finalSummaries.scopeSummary,
      eligibilitySummary: finalSummaries.eligibilitySummary,
      timelineSummary: finalSummaries.timelineSummary,
      financialSummary: finalSummaries.financialSummary,
      riskSummary: finalSummaries.riskSummary,
      recommendation: finalSummaries.recommendation,
      aiModel: aiNote,
      processingTimeMs: Date.now() - start,
    });

    const legacyData = mergedToLegacyAnalysis(merged);
    await tenderAnalysisRepository.create({
      tenderId: new Types.ObjectId(payload.tenderId),
      documentId: document._id,
      analyzedBy: new Types.ObjectId(payload.userId),
      ...legacyData,
      aiRecommendation: aiNote,
      processingTimeMs: Date.now() - start,
    });

    await tenderRepository.updateFromAnalysis(payload.tenderId, legacyData);
    await tenderRepository.setStatus(payload.tenderId, TenderStatus.NIT_ANALYZED, 'Analysis Complete');

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    await job.save();
    this.emitComplete(payload.tenderId, payload.jobId, intelligence.toObject(), payload.queueJobId);
  }

  private async readDocumentBuffer(
    document: import('../../models/TenderDocument').ITenderDocument
  ): Promise<Buffer> {
    if (!document.localPath) {
      throw new Error('Document file path missing — re-upload the tender document');
    }
    const fullPath = fileStorageService.getAbsolutePath(document.localPath);
    return fs.readFile(fullPath);
  }
}

export const intelligencePipeline = new IntelligencePipeline();
