import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import { FieldLocatorEngineResult, FieldLocatorResult } from '../../types/fieldLocator';
import { DocumentLocatorField } from '../../models/DocumentLocatorField';
import { fieldLocatorEngine } from '../fieldLocator/fieldLocatorEngine';
import { FIELD_LOCATOR_FIELD_ORDER } from '../fieldLocator/fieldLocatorRegistry';
import { parameterDiscoveryService } from '../parameterDiscovery/parameterDiscoveryService';
import { ParameterDiscoveryResult } from '../../types/parameterDiscovery';
import { parameterMappingService } from '../parameterMapping/parameterMappingService';
import { MappedBusinessField } from '../../types/parameterMapping';
import { fieldValidationService, FieldValidationStoreContext } from '../validation/fieldValidationService';
import { documentPageService } from '../ocr/documentPageService';
import { ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { ocrNormalizationService } from '../ocr/ocrNormalizationService';
import { DocumentPage } from '../../models/DocumentPage';
import { tenderParameterCandidateExtractionService } from '../tenderParameter/tenderParameterCandidateExtractionService';
import { tenderServiceClassificationService } from '../tenderClassification/tenderServiceClassificationService';
import { requirementDiscoveryService } from '../requirementDiscovery/requirementDiscoveryService';
import { validatedMasterDatasetService } from '../masterTenderDataset/validatedMasterDatasetService';
import { dynamicChecklistService } from '../dynamicChecklist/dynamicChecklistService';
import { canonicalTenderPipeline } from './canonicalTenderPipeline';

export interface TenderProductionPipelineContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  pages?: PageText[];
}

export interface NitExtractionFastResult {
  steps: string[];
  masterDataset: ValidatedMasterDatasetResult;
  candidateCount: number;
  previewOnly: boolean;
  pagesScanned: number;
}

export interface TenderProductionPipelineResult {
  steps: string[];
  discoveredParameters: ParameterDiscoveryResult;
  labelValuePairCount: number;
  mappedFieldCount: number;
  locatorFieldCount: number;
  validation: {
    totalFields: number;
    validCount: number;
    invalidCount: number;
  };
  fields: FieldLocatorResult[];
  mappedFields: MappedBusinessField[];
}

/**
 * Production flow (after OCR):
 * PDF → OCR → Dynamic Parameters → Mapping Engine → Master Dataset → NIT Analysis
 */
class TenderProductionPipeline {
  async loadPages(documentId: Types.ObjectId): Promise<PageText[]> {
    const pages = await DocumentPage.find({ documentId }).sort({ pageNumber: 1 });
    return documentPageService.toPageText(pages);
  }

  async saveLocatorFields(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    fields: FieldLocatorResult[]
  ): Promise<void> {
    await DocumentLocatorField.deleteMany({ documentId });
    if (!fields.length) return;

    await DocumentLocatorField.insertMany(
      fields.map((f) => ({
        documentId,
        tenderId,
        fieldName: f.fieldName,
        value: f.value,
        sourcePage: f.sourcePage,
        sourceText: f.sourceText,
        extractionMethod: f.extractionMethod,
        confidence: f.confidence,
      }))
    );
  }

  /**
   * Fast path for NIT Analysis — AI candidates + validated master dataset only.
   * Use maxPages (e.g. 15) for an early preview from the NIT section at the front of the PDF.
   */
  async runNitExtractionFast(
    ctx: TenderProductionPipelineContext,
    opts?: { maxPages?: number; refresh?: boolean }
  ): Promise<NitExtractionFastResult> {
    const pages = ctx.pages?.length ? ctx.pages : await this.loadPages(ctx.documentId);
    if (!pages.length) throw new Error('No OCR pages available for NIT extraction');

    const workPageCount =
      opts?.maxPages && opts.maxPages > 0 ? Math.min(opts.maxPages, pages.length) : pages.length;

    const canonical = await canonicalTenderPipeline.run(ctx, {
      maxPages: opts?.maxPages,
      refresh: opts?.refresh,
    });

    return {
      steps: canonical.steps,
      masterDataset: canonical.masterDataset,
      candidateCount: canonical.candidateCount,
      previewOnly: workPageCount < pages.length,
      pagesScanned: canonical.pagesScanned,
    };
  }

  /** Full-document extraction in background after a preview pass. */
  scheduleFullNitExtraction(ctx: TenderProductionPipelineContext): void {
    void canonicalTenderPipeline
      .run(ctx, { refresh: true })
      .then((result) => {
        console.log('[ProductionPipeline] Background canonical pipeline done', {
          documentId: String(ctx.documentId),
          candidates: result.candidateCount,
          validated: result.masterDataset.statistics.validatedCount,
          nitFields: result.nitAnalysis.statistics.populatedFields,
        });
      })
      .catch((err) => {
        console.error('[ProductionPipeline] Background canonical pipeline failed', {
          documentId: String(ctx.documentId),
          error: String(err),
        });
      });
  }

  /**
   * Run full production extraction on OCR pages.
   * Does not run OpenAI or NIT rule engines.
   */
  async run(ctx: TenderProductionPipelineContext): Promise<TenderProductionPipelineResult> {
    const steps: string[] = [];
    const pages = ctx.pages?.length ? ctx.pages : await this.loadPages(ctx.documentId);
    if (!pages.length) {
      throw new Error('No OCR pages available for production extraction');
    }

    steps.push('ocr_complete');

    const normalization = await ocrNormalizationService.normalizeAndStore(
      ctx.documentId,
      ctx.tenderId,
      pages
    );
    ocrNormalizationService.assertNormalizationReady(normalization);
    steps.push(
      normalization.totalRecords > 0 ? 'ocr_normalization' : 'ocr_normalization_full_page_ai'
    );

    const fast = await this.runNitExtractionFast(ctx);
    steps.push(...fast.steps);
    steps.push('candidate_ranking', 'rule_validation');

    const requirements = await requirementDiscoveryService.discoverAndStore(ctx.documentId, ctx.tenderId);
    console.log('[ProductionPipeline] Requirement Discovery', {
      totalItems: requirements.totalItems,
      mentionedInTender: requirements.mentionedInTenderCount,
    });
    steps.push('requirement_discovery');

    const dynamicChecklist = await dynamicChecklistService.generateAndStore(ctx.documentId, ctx.tenderId);
    console.log('[ProductionPipeline] Dynamic Checklist', {
      readinessScore: dynamicChecklist.summary.readinessScore,
      missing: dynamicChecklist.summary.missing,
    });
    steps.push('dynamic_checklist');

    // 1. Dynamic parameter discovery (from normalized label–value records)
    const discoveredParameters = await parameterDiscoveryService.discoverAndStore(
      ctx.documentId,
      ctx.tenderId,
      { maxPage: null }
    );
    console.log('[ProductionPipeline] Dynamic Parameter Discovery', {
      total: discoveredParameters.totalFound,
    });
    steps.push('dynamic_parameter_discovery');
    steps.push('store_all_parameters');

    // 2. Mapping Engine — dynamic parameters → business fields (master dataset keys)
    const engineParams = discoveredParameters.parameters.map((p) => ({
      parameterName: p.parameterName,
      parameterValue: p.parameterValue,
      sourcePage: p.pageNumber,
      confidence: p.confidence,
    }));
    const mapping = await parameterMappingService.mapDocument(
      ctx.documentId,
      ctx.tenderId,
      engineParams
    );
    steps.push('parameter_mapping_engine');

    // 3. Supplement with rule-based field locator (production mode)
    const located: FieldLocatorEngineResult = fieldLocatorEngine.locate(pages, {
      debugMode: false,
    });

    let fields = parameterMappingService.applyMappingsToLocatorFields(located.fields, mapping.mappedFields);

    for (const m of mapping.mappedFields) {
      if (!fields.some((f) => f.fieldName === m.businessFieldName)) {
        fields.push({
          fieldName: m.businessFieldName,
          value: m.value,
          sourcePage: m.sourcePage,
          sourceText: m.sourceText,
          extractionMethod: 'alias',
          confidence: m.confidence,
        });
      }
    }

    fields = fields.filter((f) => f.value?.trim());
    await this.saveLocatorFields(ctx.documentId, ctx.tenderId, fields);
    steps.push('store_mapped_locator_fields');

    // 4. Validation (canonical mapped fields)
    const validationCtx: FieldValidationStoreContext = {
      documentId: ctx.documentId,
      tenderId: ctx.tenderId,
      jobId: ctx.jobId,
    };

    const validationInput = fields.map((f) => ({
      fieldName: f.fieldName,
      extractedValue: f.value,
    }));

    const validationResult = await fieldValidationService.validateAndStore(
      validationInput,
      validationCtx
    );
    steps.push('validation');

    return {
      steps,
      discoveredParameters,
      labelValuePairCount: discoveredParameters.totalFound,
      mappedFieldCount: mapping.mappedFields.length,
      locatorFieldCount: fields.length,
      validation: {
        totalFields: validationResult.statistics.totalFields,
        validCount: validationResult.statistics.validCount,
        invalidCount: validationResult.statistics.invalidCount,
      },
      fields,
      mappedFields: mapping.mappedFields,
    };
  }

  /** Production extraction + master dataset (dashboard source). */
  async runThroughDashboard(ctx: TenderProductionPipelineContext) {
    const pipelineResult = await this.run(ctx);
    const validated = await validatedMasterDatasetService.getByDocumentId(ctx.documentId);
    const legacy = validated
      ? await validatedMasterDatasetService.getLegacyDatasetForReports(ctx.documentId)
      : null;
    return {
      pipeline: pipelineResult,
      validatedMasterDataset: validated,
      dataset: legacy?.dataset,
      statistics: legacy?.statistics,
    };
  }

  missingCanonicalFields(fields: FieldLocatorResult[]): string[] {
    return FIELD_LOCATOR_FIELD_ORDER.filter(
      (name) => !fields.some((f) => f.fieldName === name && f.value?.trim())
    );
  }
}

export const tenderProductionPipeline = new TenderProductionPipeline();
