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
import { isQuotaBlocked, markQuotaExceeded } from '../ai/aiQuotaGuard';
import { isOpenAIApiError } from '../ai/openaiClient';
import { confidenceScoringService } from '../confidence/confidenceScoringService';
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { canonicalTenderPipeline } from '../production/canonicalTenderPipeline';
import {
  buildIntelligencePayloadFromCanonical,
  buildLegacyAnalysisFromMasterDataset,
} from '../production/canonicalIntelligenceBuilder';
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
  refresh?: boolean;
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

      // Canonical 12-step pipeline (preview → full document)
      job.status = 'analyzing';
      job.progress = 12;
      job.pageCount = pages.length;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 12, payload.queueJobId);

      const pipelineCtx = {
        documentId: document._id,
        tenderId: job.tenderId,
        jobId: job._id,
        pages,
      };

      const onPipelineProgress = async (
        pct: number,
        step?: import('../production/canonicalTenderPipeline').CanonicalPipelineStep
      ) => {
        job.progress = Math.min(98, pct);
        if (step === 'master_dataset' || step === 'nit_analysis') {
          job.status = 'merging';
        } else if (
          step === 'requirement_discovery' ||
          step === 'checklist' ||
          step === 'feasibility_report'
        ) {
          job.status = 'generating_report';
        } else {
          job.status = 'analyzing';
        }
        await IntelligenceJob.findByIdAndUpdate(job._id, {
          progress: job.progress,
          status: job.status,
        });
        this.emitProgress(
          payload.tenderId,
          payload.jobId,
          job.status,
          job.progress,
          payload.queueJobId
        );
      };

      const usePreview = pages.length > 15 && !payload.refresh;
      let canonicalResult = await canonicalTenderPipeline.run(pipelineCtx, {
        maxPages: usePreview ? 15 : undefined,
        refresh: payload.refresh,
        onProgress: async (pct, step) => onPipelineProgress(pct, step),
        onPreview: async (preview) => {
          this.emitPreview(payload.tenderId, payload.jobId, 85, {
            phase: 'nit_preview',
            nitReady: preview.nitAnalysis.statistics.populatedFields > 0,
            parameterCount:
              preview.masterDataset.statistics.validatedCount ||
              preview.masterDataset.parameters.length,
            pipelineSteps: ['master_dataset', 'nit_analysis'],
          });
          await onPipelineProgress(85, 'nit_analysis');
        },
      });

      this.emitPreview(payload.tenderId, payload.jobId, job.progress, {
        phase: 'nit_preview',
        nitReady: canonicalResult.masterDataset.parameters.length > 0,
        parameterCount: canonicalResult.masterDataset.parameters.length,
        pipelineSteps: canonicalResult.steps,
      });

      if (usePreview) {
        canonicalResult = await canonicalTenderPipeline.run(pipelineCtx, {
          refresh: true,
          onProgress: async (pct) => onPipelineProgress(pct),
        });
      }

      timer.mark('canonical_pipeline');

      const intelligencePayload = buildIntelligencePayloadFromCanonical(canonicalResult, {
        processingTimeMs: Date.now() - start,
      });

      job.status = 'generating_report';
      job.progress = 95;
      await job.save();
      this.emitProgress(payload.tenderId, payload.jobId, job.status, 95, payload.queueJobId);

      const intelligence = await TenderIntelligence.findOneAndUpdate(
        { tenderId: job.tenderId, jobId: job._id },
        {
          $set: {
            ...intelligencePayload,
            tenderId: job.tenderId,
            documentId: document._id,
            jobId: job._id,
            analyzedBy: new Types.ObjectId(payload.userId),
            pageCount: pages.length,
            chunkCount: Math.ceil(pages.length / 5),
          },
        },
        { upsert: true, new: true }
      );
      if (!intelligence) throw new Error('Failed to save intelligence results');

      const legacyData = buildLegacyAnalysisFromMasterDataset(canonicalResult.masterDataset);
      await tenderAnalysisRepository.create({
        tenderId: new Types.ObjectId(payload.tenderId),
        documentId: document._id,
        analyzedBy: new Types.ObjectId(payload.userId),
        ...legacyData,
        rawText: document.extractedText?.slice(0, 50000),
        aiModel: 'canonical-tender-pipeline',
        processingTimeMs: Date.now() - start,
      });

      await tenderRepository.updateFromAnalysis(payload.tenderId, legacyData);
      await tenderRepository.setStatus(payload.tenderId, TenderStatus.NIT_ANALYZED, 'Analysis Completed');

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      await job.save();

      const totalMs = Date.now() - start;
      console.log('[Pipeline] Canonical analysis complete', timer.summary({
        tenderId: payload.tenderId,
        documentId: payload.documentId,
        pageCount: pages.length,
        validatedParams: canonicalResult.masterDataset.statistics.validatedCount,
        nitFields: canonicalResult.nitAnalysis.statistics.populatedFields,
        totalMs,
      }));

      this.emitComplete(payload.tenderId, payload.jobId, intelligence.toObject(), payload.queueJobId);
      return;

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
        await tenderRepository.setStatus(payload.tenderId, TenderStatus.NIT_ANALYZED, 'Analysis Completed');
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
    await tenderRepository.setStatus(payload.tenderId, TenderStatus.NIT_ANALYZED, 'Analysis Completed');

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
