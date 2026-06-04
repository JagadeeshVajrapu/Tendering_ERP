/**
 * @deprecated Use fieldDictionaryEngine — re-exported for compatibility.
 */
export {
  validateFieldBusinessRules,
  MANDATORY_AI_VERIFY_FIELD_IDS,
  validateFieldDictionary,
  isRejectedByDictionary,
  isDisplayableByDictionary,
  type FieldDictionaryResult,
} from './fieldDictionaryEngine';

export type FieldRuleValidation = import('./fieldDictionaryEngine').FieldDictionaryResult;
