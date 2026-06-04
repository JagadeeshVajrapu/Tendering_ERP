import {
  MasterDatasetBuildResult,
  MasterDatasetField,
  MasterDatasetKey,
  MasterDatasetProvenance,
  MasterDatasetStatistics,
  MasterTenderDataset,
  MASTER_DATASET_KEYS,
} from '../../types/masterDataset';
import {
  BID_DATE_SUBLABEL_MAP,
} from './masterDatasetFieldRegistry';
import { mergeWithPriority, PriorityMergeInput } from './masterDatasetPriorityMerge';

export interface SourceFieldRecord {
  fieldName: string;
  value: string;
  confidence: number;
  sourcePage: number;
  sourceText: string;
  extractionMethod?: string;
}

export interface MasterDatasetBuildInput extends PriorityMergeInput {
  provenance: MasterDatasetProvenance;
}

function parseBidDatesComposite(
  bidDatesValue: string,
  sourcePage: number,
  sourceText: string,
  confidence: number
): Partial<Record<MasterDatasetKey, MasterDatasetField>> {
  const out: Partial<Record<MasterDatasetKey, MasterDatasetField>> = {};
  if (!bidDatesValue?.trim()) return out;

  const segments = bidDatesValue.split('|').map((s) => s.trim()).filter(Boolean);
  for (const segment of segments) {
    const colonIdx = segment.indexOf(':');
    if (colonIdx < 0) continue;
    const label = segment.slice(0, colonIdx).toLowerCase().replace(/\s+/g, ' ').trim();
    const value = segment.slice(colonIdx + 1).trim();
    if (!value) continue;

    const masterKey = BID_DATE_SUBLABEL_MAP[label];
    if (masterKey && !out[masterKey]?.value) {
      out[masterKey] = {
        value,
        confidence,
        sourcePage,
        sourceText: segment,
        extractionMethod: 'rule_extraction',
      };
    }
  }

  return out;
}

class MasterDatasetBuilder {
  build(input: MasterDatasetBuildInput): MasterDatasetBuildResult {
    const started = Date.now();
    const { dataset, traces: _traces } = mergeWithPriority(input);

    const bidDatesHit = input.extractedFields.find(
      (e) => e.fieldName.toLowerCase().includes('bid date') && e.value?.trim()
    );
    if (bidDatesHit) {
      const parsed = parseBidDatesComposite(
        bidDatesHit.value,
        bidDatesHit.sourcePage,
        bidDatesHit.sourceText,
        bidDatesHit.confidence
      );
      for (const [k, field] of Object.entries(parsed) as [MasterDatasetKey, MasterDatasetField][]) {
        if (!dataset[k].value || field.confidence > dataset[k].confidence) {
          dataset[k] = field;
        }
      }
    }

    if (!dataset.tenderTitle.value && dataset.workName.value) {
      dataset.tenderTitle = { ...dataset.workName };
    }
    if (!dataset.tenderValue.value && dataset.estimatedCost.value) {
      dataset.tenderValue = { ...dataset.estimatedCost };
    }
    if (!dataset.estimatedCost.value && dataset.tenderValue.value) {
      dataset.estimatedCost = { ...dataset.tenderValue };
    }
    if (!dataset.contractPeriod.value && dataset.completionPeriod.value) {
      dataset.contractPeriod = { ...dataset.completionPeriod };
    }

    const populated = MASTER_DATASET_KEYS.filter((k) => dataset[k].value.trim().length > 0);
    const confidences = populated.map((k) => dataset[k].confidence);
    const averageConfidence = confidences.length
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

    const statistics: MasterDatasetStatistics = {
      totalFields: MASTER_DATASET_KEYS.length,
      populatedFields: populated.length,
      averageConfidence,
      lowConfidenceFields: populated.filter((k) => dataset[k].confidence < 80).length,
      processingTimeMs: Date.now() - started,
    };

    console.log('[MasterDataset] Built (priority merge)', {
      populatedFields: statistics.populatedFields,
      locatorFields: input.fieldLocatorFields.length,
      averageConfidence: statistics.averageConfidence,
    });

    return { dataset: dataset as MasterTenderDataset, statistics };
  }
}

export const masterDatasetBuilder = new MasterDatasetBuilder();
