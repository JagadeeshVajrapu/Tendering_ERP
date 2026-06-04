export type ValidationField =
  | 'date'
  | 'currency'
  | 'email'
  | 'phone'
  | 'tenderNumber';

export interface ValidationResult {
  field: ValidationField;
  value: string;
  valid: boolean;
  reason: string;
}

