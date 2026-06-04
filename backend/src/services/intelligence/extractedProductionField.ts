import { IntelligenceFieldKey } from '../../types/intelligence';

export interface ExtractedProductionField {
  id: string;
  label: string;
  mergeKey: IntelligenceFieldKey;
  section: string;
  value: string | string[] | null;
  sourcePage: number;
  sourceText?: string;
  confidence: number;
  validated: boolean;
  needsReview: boolean;
}
