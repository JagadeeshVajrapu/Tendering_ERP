export interface FieldValidationRecord {
  fieldName: string;
  value: string;
  valid: boolean;
  reason: string;
  rawValue?: string;
  validationType?: string;
}

export interface FieldValidationStatistics {
  totalFields: number;
  validCount: number;
  invalidCount: number;
  processingTimeMs: number;
}

export interface FieldValidationResult {
  validations: FieldValidationRecord[];
  statistics: FieldValidationStatistics;
}
