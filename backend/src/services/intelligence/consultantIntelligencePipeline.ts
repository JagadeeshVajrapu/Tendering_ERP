/**
 * Consultant-Grade Tender Intelligence Pipeline (9 steps).
 * No direct AI extraction — rule engine + dictionary + per-field AI verification only.
 */

import { IntelligenceFieldKey, MergedIntelligence, PageText } from '../../types/intelligence';
import { ExtractedTable } from './tableExtractionService';
import { documentUnderstandingService, ConsultantDocumentUnderstanding } from './documentUnderstandingService';
import { CONSULTANT_FIELD_IDS } from './consultantFieldRegistry';
import { PRODUCTION_FIELDS, ProductionFieldDefinition } from './fieldDefinitions';
import { productionFieldPipeline } from './productionFieldPipeline';
import { ExtractedProductionField } from './extractedProductionField';
import { buildEmptyMerged } from './fields';
import { validateMergedField } from './valueValidator';
import { verifiedNitJsonBuilder, VerifiedNitJson } from './verifiedNitJsonBuilder';
import { buildConsultantExecutiveSummaries } from './consultantExecutiveOutputs';
import { nitTableBuilder } from './nitTableBuilder';
import { missingFieldRecoveryService } from './missingFieldRecoveryService';
import { FeasibilityRecommendation, NitAnalysisSheet, MdReport } from '../../types/intelligence';
import { riskAnalysisEngine } from '../risk/riskAnalysisEngine';
import { RiskAnalysisResult } from '../../types/riskAnalysis';
import { computeConsultantRecommendation } from './consultantExecutiveOutputs';
import { env } from '../../config/env';
import { mapWithConcurrency } from '../../utils/concurrency';
import { ChunkPipelineArtifacts, documentChunkProcessorService } from './documentChunkProcessorService';

export interface ConsultantPipelineOptions {
  chunkArtifacts?: ChunkPipelineArtifacts;
}

export interface ConsultantPipelineResult {
  documentUnderstanding: ConsultantDocumentUnderstanding;
  structuredTables: ExtractedTable[];
  productionFields: ExtractedProductionField[];
  verifiedNit: VerifiedNitJson;
  merged: MergedIntelligence;
  nitTables: NitAnalysisSheet;
  mdReport: MdReport;
  riskAnalysis: RiskAnalysisResult;
  summaries: {
    scopeSummary: string;
    eligibilitySummary: string;
    timelineSummary: string;
    financialSummary: string;
    riskSummary: string;
    recommendation: FeasibilityRecommendation;
    executiveBullets: string[];
  };
  stagesCompleted: string[];
}

class ConsultantIntelligencePipeline {
  async run(
    pages: PageText[],
    onProgress?: (pct: number, label: string) => void | Promise<void>,
    options?: ConsultantPipelineOptions
  ): Promise<ConsultantPipelineResult> {
    const stages: string[] = [];

    // Step 1 — Parallel chunk prep (5-page chunks) + document map
    const chunkArtifacts =
      options?.chunkArtifacts ?? (await documentChunkProcessorService.processPages(pages));
    const documentUnderstanding = documentUnderstandingService.understand(
      pages,
      chunkArtifacts.documentMap
    );
    stages.push('step_1_document_understanding', 'table_extraction');

    console.log('[Pipeline] Chunk processing', {
      pages: pages.length,
      chunks: chunkArtifacts.chunkCount,
      tables: chunkArtifacts.structuredTables.length,
      chunkMs: chunkArtifacts.processingTimeMs,
      statistics: chunkArtifacts.statistics,
    });

    const { documentMap } = documentUnderstanding;
    const structuredTables = chunkArtifacts.structuredTables;
    const pageMap = new Map(pages.map((p) => [p.pageNumber, p]));
    const byId = new Map<string, ExtractedProductionField>();

    const fieldDefs = CONSULTANT_FIELD_IDS.map((id) => PRODUCTION_FIELDS.find((f) => f.id === id)).filter(
      Boolean
    ) as ProductionFieldDefinition[];

    // Steps 2–6 — parallel field extraction (bounded concurrency)
    const fieldConcurrency = env.intelligence.fieldConcurrency;
    let done = 0;
    await mapWithConcurrency(fieldDefs, fieldConcurrency, async (def) => {
      const result = await productionFieldPipeline.processField(def, pages, {
        documentMap,
        structuredTables,
        pageMap,
      });
      done++;
      await onProgress?.(
        Math.round((done / fieldDefs.length) * 100),
        `Extracting: ${def.label}`
      );

      if (!result) return null;

      byId.set(def.id, {
        id: def.id,
        label: def.label,
        mergeKey: def.mergeKey,
        section: def.section,
        value: result.value,
        sourcePage: result.sourcePage,
        sourceText: result.sourceText,
        confidence: result.confidence,
        validated: true,
        needsReview: result.needsReview,
      });
      return result;
    });
    stages.push('step_2_candidate_collection', 'step_3_ranking', 'step_4_validation', 'step_5_ai_verification');

    let productionFields: ExtractedProductionField[] = [...byId.values()];

    // Missing field recovery — main, tables, annexures, schedules
    productionFields = await missingFieldRecoveryService.recoverMissingFields(
      productionFields,
      pages,
      documentMap,
      structuredTables
    );
    stages.push('missing_field_recovery');

    // Step 6 — Structured JSON (verified only)
    const verifiedNit = verifiedNitJsonBuilder.build(productionFields);
    stages.push('step_6_structured_json');

    const merged = this.buildMergedFromFields(productionFields);

    // Step 7 — Risk analysis (after OCR, rules, validation, AI verification)
    const preliminaryRecommendation = computeConsultantRecommendation(
      productionFields,
      verifiedNit
    );

    const riskAnalysis = riskAnalysisEngine.analyze({
      pages,
      productionFields,
      verifiedNit,
      merged,
      recommendation: preliminaryRecommendation,
      stagesCompleted: stages,
    });
    stages.push('step_7_risk_analysis');

    const summaries = buildConsultantExecutiveSummaries(
      productionFields,
      verifiedNit,
      riskAnalysis
    );

    const nitTables = nitTableBuilder.build(
      merged,
      summaries.recommendation,
      productionFields,
      verifiedNit,
      riskAnalysisEngine.toNitRiskItems(riskAnalysis),
      riskAnalysis
    );
    stages.push('step_8_executive_nit_table');

    // Step 8 — Executive summary (in summaries + nitTables.executiveSummary)
    nitTables.executiveSummary = summaries.executiveBullets;
    stages.push('step_9_executive_summary');

    const mdReport = nitTableBuilder.buildMdReport(
      productionFields,
      merged,
      summaries.recommendation,
      riskAnalysis
    );
    stages.push('step_10_md_feasibility_report');

    stages.push('consultant_pipeline_complete');

    return {
      documentUnderstanding,
      structuredTables,
      productionFields,
      verifiedNit,
      merged,
      nitTables,
      mdReport,
      riskAnalysis,
      summaries,
      stagesCompleted: stages,
    };
  }

  private buildMergedFromFields(fields: ExtractedProductionField[]): MergedIntelligence {
    const merged = buildEmptyMerged() as MergedIntelligence;
    for (const pf of fields) {
      const key = pf.mergeKey as IntelligenceFieldKey;
      merged[key] = validateMergedField(key, {
        value: pf.value,
        sourcePages: [pf.sourcePage],
        confidence: pf.confidence,
        validated: true,
        allExtractions: [{ value: pf.value, page: pf.sourcePage, confidence: pf.confidence }],
      });
    }
    return merged;
  }
}

export const consultantIntelligencePipeline = new ConsultantIntelligencePipeline();
