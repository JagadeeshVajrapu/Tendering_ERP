import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import { ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { NitAnalysisReport } from '../../types/nitAnalysisReport';
import { DynamicChecklistResult } from '../../types/dynamicChecklist';
import { RequirementDiscoveryResult } from '../../types/requirementDiscovery';
import { documentPageService } from '../ocr/documentPageService';
import { ocrNormalizationService } from '../ocr/ocrNormalizationService';
import { DocumentPage } from '../../models/DocumentPage';
import { ocrPageTextNormalizationService } from '../ocr/ocrPageTextNormalizationService';
import { tenderServiceClassificationService } from '../tenderClassification/tenderServiceClassificationService';
import { tenderIntelligenceLayerService } from '../tenderIntelligence/tenderIntelligenceLayerService';
import { tenderParameterCandidateExtractionService } from '../tenderParameter/tenderParameterCandidateExtractionService';
import { dynamicMasterDatasetService } from '../masterTenderDataset/dynamicMasterDatasetService';
import { requirementDiscoveryService } from '../requirementDiscovery/requirementDiscoveryService';
import { dynamicChecklistService } from '../dynamicChecklist/dynamicChecklistService';
import { nitAnalysisGeneratorService } from '../nit/nitAnalysisGeneratorService';
import { buildAliasHintsFromOcrRecords } from '../tenderParameter/tenderParameterAliasPreScan';
import { foundationLayerService } from '../../foundation/foundationLayerService';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';

export const CANONICAL_PIPELINE_STEPS = [
  'pdf_upload',
  'ocr',
  'foundation_layer',
  'tender_intelligence',
  'service_classification',
  'alias_engine',
  'gemini_openai_extraction',
  'candidate_ranking',
  'validation',
  'ai_verification',
  'dynamic_parameter_discovery',
  'requirement_discovery',
  'master_dataset',
  'nit_analysis',
  'checklist',
  'feasibility_report',
] as const;

export type CanonicalPipelineStep = (typeof CANONICAL_PIPELINE_STEPS)[number];

export interface CanonicalPipelineContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  pages?: PageText[];
}

export interface CanonicalPipelineResult {
  steps: CanonicalPipelineStep[];
  pagesScanned: number;
  aliasMappedCount: number;
  candidateCount: number;
  masterDataset: ValidatedMasterDatasetResult;
  nitAnalysis: NitAnalysisReport;
  requirements: RequirementDiscoveryResult;
  checklist: DynamicChecklistResult;
}

export type CanonicalProgressCallback = (progress: number, step: CanonicalPipelineStep) => void | Promise<void>;

export type CanonicalPreviewCallback = (preview: {
  masterDataset: ValidatedMasterDatasetResult;
  nitAnalysis: NitAnalysisReport;
}) => void | Promise<void>;

class CanonicalTenderPipeline {
  async loadPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  /**
   * Canonical tender flow:
   * PDF Upload → OCR → Service Classification → Alias Engine → Gemini/OpenAI Extraction
   * → Candidate Ranking → Validation → Requirement Discovery → Master Dataset
   * → NIT Analysis → Checklist → (Feasibility Report — after intelligence is saved)
   */
  async run(
    ctx: CanonicalPipelineContext,
    opts?: {
      maxPages?: number;
      refresh?: boolean;
      onProgress?: CanonicalProgressCallback;
      /** Fired as soon as master dataset + NIT report are ready (before checklist). */
      onPreview?: CanonicalPreviewCallback;
    }
  ): Promise<CanonicalPipelineResult> {
    const steps: CanonicalPipelineStep[] = ['pdf_upload'];
    const emit = async (pct: number, step: CanonicalPipelineStep) => {
      steps.push(step);
      await opts?.onProgress?.(pct, step);
    };

    const pages = ctx.pages?.length ? ctx.pages : await this.loadPages(ctx.documentId);
    if (!pages.length) throw new Error('No OCR pages available');

    const { pages: cleanedPages, stats: noiseStats } =
      ocrPageTextNormalizationService.cleanPagesForExtraction(pages);
    if (!cleanedPages.length) throw new Error('No business content after document noise removal');

    const workPages =
      opts?.maxPages && opts.maxPages > 0 ? cleanedPages.slice(0, opts.maxPages) : cleanedPages;

    // 2 — OCR normalization (label:value records for alias + AI)
    await emit(15, 'ocr');
    const normalization = await ocrNormalizationService.normalizeAndStore(
      ctx.documentId,
      ctx.tenderId,
      workPages
    );
    ocrNormalizationService.assertNormalizationReady(normalization);

    // 3 — Enterprise foundation layer + tender intelligence (before extraction)
    await emit(18, 'foundation_layer');
    await emit(20, 'tender_intelligence');
    const intelligence = await tenderIntelligenceLayerService.analyzeAndStore(
      ctx.documentId,
      ctx.tenderId,
      workPages,
      { refresh: opts?.refresh }
    );
    await emit(22, 'service_classification');
    const classification = await tenderServiceClassificationService.classifyAndStore(
      ctx.documentId,
      ctx.tenderId,
      workPages,
      { refresh: opts?.refresh }
    );
    const resolvedServiceCategory =
      (classification.serviceCategory as TenderServiceCategory) ||
      tenderIntelligenceLayerService.mapTenderTypeToServiceCategory(intelligence.tenderType);
    const foundationContext = foundationLayerService.buildFoundationContext({
      serviceCategory: resolvedServiceCategory as TenderServiceCategory,
      classificationConfidence: classification.confidence || intelligence.confidence,
      pages: workPages,
    });
    const intelligenceContext = tenderIntelligenceLayerService.buildExtractionContext(intelligence);

    // 4 — Alias engine (OCR label:value → canonical parameter names)
    await emit(30, 'alias_engine');
    const aliasScan = buildAliasHintsFromOcrRecords(
      normalization.records.map((r) => ({
        label: r.label,
        value: r.value,
        page: r.page,
        sourceText: r.sourceText,
      })),
      { serviceCategory: foundationContext.serviceCategory as TenderServiceCategory }
    );

    // 5–7 — AI extraction + ranking + validation (inside candidate service)
    await emit(38, 'gemini_openai_extraction');
    const candidateExtraction = await tenderParameterCandidateExtractionService.extractAndStore(
      ctx.documentId,
      ctx.tenderId,
      {
        refresh: opts?.refresh,
        maxPages: opts?.maxPages,
        onExtractionProgress: async (completed, total) => {
          if (total <= 0) return;
          const pct = 38 + Math.round((completed / total) * 16);
          await emit(pct, 'gemini_openai_extraction');
        },
      }
    );

    await emit(55, 'candidate_ranking');
    const rankedValidated = await tenderParameterCandidateExtractionService.rankAndValidate(
      ctx.documentId,
      ctx.tenderId,
      workPages,
      foundationContext.serviceCategory as TenderServiceCategory
    );
    await emit(62, 'validation');
    await emit(64, 'ai_verification');
    await emit(66, 'dynamic_parameter_discovery');

    // 8 — Master dataset + NIT (immediately after validation — before checklist/requirements)
    await emit(70, 'master_dataset');
    const dynamicMasterDataset = await dynamicMasterDatasetService.buildAndStore(
      ctx.documentId,
      ctx.tenderId,
      { refresh: opts?.refresh }
    );
    const masterDataset = {
      documentId: dynamicMasterDataset.documentId,
      tenderId: dynamicMasterDataset.tenderId,
      parameters: dynamicMasterDataset.parameters.map((p) => ({
        parameter: p.parameter,
        value: p.value,
        page: p.page,
        confidence: p.confidence,
        sourceText: p.sourceText,
        validationStatus:
          p.validationStatus === 'REVIEW'
            ? ('review' as const)
            : ('validated' as const),
        category: p.category,
        parameterType: p.parameterType,
        canonicalKey: p.canonicalKey,
        originalLabel: p.originalLabel,
      })),
      statistics: {
        totalParameters: dynamicMasterDataset.statistics.totalParameters,
        validatedCount: dynamicMasterDataset.statistics.validatedCount,
        coreCount: dynamicMasterDataset.statistics.coreCount,
        dynamicCount: dynamicMasterDataset.statistics.dynamicCount,
        averageConfidence: dynamicMasterDataset.statistics.averageConfidence,
        categoryCounts: dynamicMasterDataset.statistics.categoryCounts,
      },
      builtAt: dynamicMasterDataset.builtAt,
    };

    // 9 — NIT analysis report (available to UI immediately after this step)
    await emit(74, 'nit_analysis');
    const nitAnalysis = await nitAnalysisGeneratorService.generateForTender(ctx.tenderId, {
      refresh: false,
    });

    await opts?.onPreview?.({ masterDataset, nitAnalysis });

    // 10 — Requirement discovery (non-blocking for NIT display)
    await emit(88, 'requirement_discovery');
    const requirements = await requirementDiscoveryService.discoverAndStore(
      ctx.documentId,
      ctx.tenderId,
      { refresh: opts?.refresh }
    );

    // 11 — Dynamic checklist
    await emit(93, 'checklist');
    const checklist = await dynamicChecklistService.generateAndStore(ctx.documentId, ctx.tenderId, {
      refresh: opts?.refresh,
    });

    // 12 — Feasibility report is generated on-demand after TenderIntelligence is saved
    await emit(96, 'feasibility_report');

    console.log('[CanonicalPipeline] Complete', {
      documentId: String(ctx.documentId),
      tenderType: intelligence.tenderType || 'unclassified',
      serviceCategory: classification.serviceCategory || resolvedServiceCategory || 'unclassified',
      sectionsDetected: intelligence.sections.length,
      pagesScanned: workPages.length,
      noiseRemoval: noiseStats,
      aliasMappedCount: aliasScan.mappedCount,
      candidates: candidateExtraction.totalCandidates,
      validated: rankedValidated.totalCandidates,
      masterDatasetValidated: masterDataset.statistics.validatedCount,
      nitFields: nitAnalysis.statistics.populatedFields,
      requirements: requirements.totalItems,
      checklistScore: checklist.summary.readinessScore,
    });

    return {
      steps,
      pagesScanned: workPages.length,
      aliasMappedCount: aliasScan.mappedCount,
      candidateCount: candidateExtraction.totalCandidates,
      masterDataset,
      nitAnalysis,
      requirements,
      checklist,
    };
  }
}

export const canonicalTenderPipeline = new CanonicalTenderPipeline();
