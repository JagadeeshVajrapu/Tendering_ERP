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
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { documentPageService } from '../ocr/documentPageService';
import { ocrNormalizationService } from '../ocr/ocrNormalizationService';
import { DocumentPage } from '../../models/DocumentPage';

export interface TenderProductionPipelineContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  pages?: PageText[];
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
    steps.push('ocr_normalization');

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
    const dataset = await masterDatasetService.buildAndStore({
      tenderId: ctx.tenderId,
      documentId: ctx.documentId,
      jobId: ctx.jobId,
    });
    return { pipeline: pipelineResult, dataset };
  }

  missingCanonicalFields(fields: FieldLocatorResult[]): string[] {
    return FIELD_LOCATOR_FIELD_ORDER.filter(
      (name) => !fields.some((f) => f.fieldName === name && f.value?.trim())
    );
  }
}

export const tenderProductionPipeline = new TenderProductionPipeline();
