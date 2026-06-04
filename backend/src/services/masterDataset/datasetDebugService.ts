import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentLocatorField } from '../../models/DocumentLocatorField';
import { NIT_FIELD_LABELS } from '../nit/nitAnalysisSectionRegistry';
import { MASTER_DATASET_KEYS, MasterDatasetKey } from '../../types/masterDataset';
import { masterDatasetService } from './masterDatasetService';
import { mergeWithPriority } from './masterDatasetPriorityMerge';

export interface DatasetDebugRow {
  parameter: string;
  masterKey: MasterDatasetKey;
  fieldLocatorValue: string | null;
  openAiValue: string | null;
  validatedRuleValue: string | null;
  ruleExtractionValue: string | null;
  finalDatasetValue: string;
  reasonSelected: string;
  rejectionNotes: string[];
}

export interface DatasetDebugResponse {
  documentId: string;
  tenderId: string;
  originalName?: string;
  rows: DatasetDebugRow[];
}

class DatasetDebugService {
  async getDatasetFlowFull(documentId: string): Promise<DatasetDebugResponse> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const sources = await masterDatasetService.loadSourceRecords(document._id);
    const locatorFields = await DocumentLocatorField.find({ documentId: document._id });
    const fieldLocatorRecords =
      locatorFields.length > 0
        ? locatorFields.map((f) => ({
            fieldName: f.fieldName,
            value: f.value,
            confidence: f.confidence ?? 98,
            sourcePage: f.sourcePage,
            sourceText: f.sourceText,
            extractionMethod: f.extractionMethod,
          }))
        : sources.fieldLocatorFields;

    const { traces } = mergeWithPriority({
      fieldLocatorFields: fieldLocatorRecords,
      validatedFields: sources.validatedFields,
      extractedFields: sources.extractedFields,
      aiVerifiedFields: sources.aiVerifiedFields,
    });

    await masterDatasetService.buildAndStore({
      tenderId: document.tenderId,
      documentId: document._id,
    });

    const priorityKeys: MasterDatasetKey[] = [
      'tenderNumber',
      'organization',
      'emdAmount',
      'tenderValue',
      'workName',
    ];

    const keysToShow = [...priorityKeys, ...MASTER_DATASET_KEYS.filter((k) => !priorityKeys.includes(k))];

    return {
      documentId: String(document._id),
      tenderId: String(document.tenderId),
      originalName: document.originalName,
      rows: keysToShow.map((key) => {
        const trace = traces.find((t) => t.masterKey === key)!;
        return {
          parameter: NIT_FIELD_LABELS[key],
          masterKey: key,
          fieldLocatorValue: trace.fieldLocatorValue,
          openAiValue: trace.openAiValue,
          validatedRuleValue: trace.validatedRuleValue,
          ruleExtractionValue: trace.ruleExtractionValue,
          finalDatasetValue: trace.finalValue || '',
          reasonSelected: trace.reasonSelected,
          rejectionNotes: trace.rejectionNotes,
        };
      }),
    };
  }
}

export const datasetDebugService = new DatasetDebugService();
