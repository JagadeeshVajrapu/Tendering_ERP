import { MergedIntelligence, PageText } from '../../types/intelligence';
import { consultantIntelligencePipeline } from './consultantIntelligencePipeline';
import { DocumentMap } from './documentMapBuilder';
import { ExtractedProductionField } from './extractedProductionField';
import { ExtractedTable } from './tableExtractionService';
import { ConsultantDocumentUnderstanding } from './documentUnderstandingService';
import { VerifiedNitJson } from './verifiedNitJsonBuilder';

export interface VerificationPipelineResult {
  documentMap: DocumentMap;
  documentUnderstanding?: ConsultantDocumentUnderstanding;
  productionFields: ExtractedProductionField[];
  merged: MergedIntelligence;
  structuredTables: ExtractedTable[];
  verifiedNit?: VerifiedNitJson;
  stagesCompleted: string[];
}

/**
 * Delegates to Consultant-Grade 9-step pipeline (no direct AI extraction).
 */
class TenderVerificationOrchestrator {
  async runRuleAndVerificationPasses(pages: PageText[]): Promise<VerificationPipelineResult> {
    const result = await consultantIntelligencePipeline.run(pages);
    return {
      documentMap: result.documentUnderstanding.documentMap,
      documentUnderstanding: result.documentUnderstanding,
      productionFields: result.productionFields,
      merged: result.merged,
      structuredTables: result.structuredTables,
      verifiedNit: result.verifiedNit,
      stagesCompleted: result.stagesCompleted,
    };
  }
}

export const tenderVerificationOrchestrator = new TenderVerificationOrchestrator();
