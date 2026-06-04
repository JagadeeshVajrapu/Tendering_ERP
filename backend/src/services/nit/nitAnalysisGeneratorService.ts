import { Types } from 'mongoose';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { AppError } from '../../middleware/errorHandler';
import { parameterDiscoveryService } from '../parameterDiscovery/parameterDiscoveryService';
import { parameterMappingService } from '../parameterMapping/parameterMappingService';
import { masterDatasetService } from '../masterDataset/masterDatasetService';
import { tenderProductionPipeline } from '../production/tenderProductionPipeline';
import { MasterTenderDataset } from '../../types/masterDataset';
import {
  NitAnalysisFieldRow,
  NitAnalysisReport,
  NitAnalysisSectionReport,
  NitAnalysisStatistics,
} from '../../types/nitAnalysisReport';
import { NIT_ANALYSIS_SECTIONS, NIT_FIELD_LABELS } from './nitAnalysisSectionRegistry';
import { NIT_TENDER_PARAMETER_ORDER } from './nitAnalysisDisplayOrder';
import { DynamicParameterEngineResult } from '../../types/dynamicParameter';

function buildFieldRow(
  key: NitAnalysisFieldRow['key'],
  dataset: MasterTenderDataset
): NitAnalysisFieldRow | null {
  const field = dataset[key];
  if (!field?.value?.trim()) return null;
  return {
    key,
    label: NIT_FIELD_LABELS[key],
    value: field.value.trim(),
    confidence: field.confidence,
    sourcePage: field.sourcePage,
    sourceText: field.sourceText,
    extractionMethod: field.extractionMethod,
  };
}

function buildTenderParameters(dataset: MasterTenderDataset): NitAnalysisFieldRow[] {
  const seen = new Set<string>();
  const rows: NitAnalysisFieldRow[] = [];

  for (const key of NIT_TENDER_PARAMETER_ORDER) {
    const row = buildFieldRow(key, dataset);
    if (!row || seen.has(row.key)) continue;
    seen.add(row.key);
    rows.push(row);
  }

  return rows;
}

function buildSectionsFromDataset(dataset: MasterTenderDataset): NitAnalysisSectionReport[] {
  const sections: NitAnalysisSectionReport[] = [];

  for (const def of NIT_ANALYSIS_SECTIONS) {
    const fields = def.fields
      .map((key) => buildFieldRow(key, dataset))
      .filter((row): row is NitAnalysisFieldRow => row !== null);

    if (fields.length) {
      sections.push({
        id: def.id,
        title: def.title,
        description: def.description,
        fields,
      });
    }
  }

  return sections;
}

function computeStatistics(
  engine: DynamicParameterEngineResult,
  mappedCount: number,
  datasetStats: { populatedFields: number; totalFields: number; averageConfidence: number },
  tenderParamCount: number
): NitAnalysisStatistics {
  const confidences = engine.parameters.map((p) => p.confidence);
  const discoveredAvg =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

  return {
    totalDiscovered: engine.totalFound,
    mappedCount,
    populatedFields: tenderParamCount || datasetStats.populatedFields,
    totalMasterFields: datasetStats.totalFields,
    pagesScanned: engine.pagesScanned,
    averageConfidence:
      tenderParamCount > 0 ? datasetStats.averageConfidence : discoveredAvg,
  };
}

class NitAnalysisGeneratorService {
  generateFromPipeline(
    tenderId: string,
    documentId: string,
    originalName: string | undefined,
    engine: DynamicParameterEngineResult,
    mappedCount: number,
    dataset: MasterTenderDataset,
    datasetStats: { populatedFields: number; totalFields: number; averageConfidence: number },
    steps: string[]
  ): NitAnalysisReport {
    const tenderParameters = buildTenderParameters(dataset);
    const sections = buildSectionsFromDataset(dataset);

    console.log('[NIT Analysis] Tender parameters', {
      tenderId,
      documentId,
      discovered: engine.totalFound,
      mapped: mappedCount,
      tenderFields: tenderParameters.length,
    });

    return {
      tenderId,
      documentId,
      originalName,
      generatedAt: new Date().toISOString(),
      dataSource: 'master_dataset',
      pipeline: { steps },
      tenderParameters,
      sections,
      statistics: computeStatistics(
        engine,
        mappedCount,
        datasetStats,
        tenderParameters.length
      ),
    };
  }

  async generateForTender(
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<NitAnalysisReport> {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) throw new AppError('No document found for this tender. Upload a PDF first.', 404);

    const pageCount = await DocumentPage.countDocuments({ documentId: document._id });
    if (!pageCount) {
      throw new AppError(
        'OCR has not completed for this document. Wait for processing to finish, then refresh.',
        400
      );
    }

    const refresh = !!opts?.refresh;
    let steps: string[] = [];

    const existing = await masterDatasetService.getByDocumentId(document._id);
    const needsPipeline =
      refresh || !existing?.statistics?.populatedFields;

    if (needsPipeline) {
      const result = await tenderProductionPipeline.runThroughDashboard({
        documentId: document._id,
        tenderId: document.tenderId,
      });
      steps = [
        'dynamic_parameters',
        'mapping_engine',
        'master_dataset',
        ...result.pipeline.steps,
      ];
    } else {
      await masterDatasetService.buildAndStore({
        tenderId: document.tenderId,
        documentId: document._id,
      });
      steps = ['dynamic_parameters', 'mapping_engine', 'master_dataset'];
    }

    const engine = await parameterDiscoveryService.runEngineForDocument(
      document._id,
      document.tenderId,
      refresh
    );

    const mapping = await parameterMappingService.mapDocument(
      document._id,
      document.tenderId,
      engine.parameters
    );
    steps.push(`mapping_${mapping.mappedCount}`);

    const stored = await masterDatasetService.getByDocumentId(document._id);
    if (!stored?.dataset) {
      throw new AppError(
        'Master dataset could not be built. Click Refresh after OCR completes.',
        400
      );
    }

    const report = this.generateFromPipeline(
      String(tender._id),
      String(document._id),
      document.originalName,
      engine,
      mapping.mappedCount,
      stored.dataset,
      stored.statistics,
      steps
    );

    if (!report.tenderParameters.length) {
      throw new AppError(
        'No tender fields (Tender Number, EMD, Name of Work, etc.) could be mapped. Click Refresh after OCR completes, or verify the NIT document contains standard labels.',
        400
      );
    }

    return report;
  }
}

export const nitAnalysisGeneratorService = new NitAnalysisGeneratorService();
