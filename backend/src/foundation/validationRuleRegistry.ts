import { ValidationRuleRegistryEntry } from '../types/foundationLayer';
import { PARAMETER_VALIDATION_RULES } from '../services/tenderParameter/parameterValidationRules';

/**
 * Part 6 — Validation Rule Registry.
 * Data-driven rules consumed by validation engines.
 */
export const VALIDATION_RULE_REGISTRY: ValidationRuleRegistryEntry[] = [
  {
    id: 'tender_value_currency',
    parameterKeys: ['tenderValue'],
    ruleType: 'currency',
    description: 'Tender Value must be a valid currency amount',
    nearLabels: [...PARAMETER_VALIDATION_RULES.tenderValue.nearLabels],
    forbiddenNear: [...PARAMETER_VALIDATION_RULES.tenderValue.forbiddenNear],
  },
  {
    id: 'tender_value_context',
    parameterKeys: ['tenderValue'],
    ruleType: 'near_label',
    description: 'Tender Value must appear near Estimated Tender Value / Tender Value / Project Cost labels',
    nearLabels: [...PARAMETER_VALIDATION_RULES.tenderValue.nearLabels],
    forbiddenNear: [...PARAMETER_VALIDATION_RULES.tenderValue.forbiddenNear],
  },
  {
    id: 'emd_currency',
    parameterKeys: ['emdAmount'],
    ruleType: 'currency',
    description: 'EMD Amount must be a valid currency amount',
    nearLabels: [...PARAMETER_VALIDATION_RULES.emdAmount.nearLabels],
  },
  {
    id: 'emd_context',
    parameterKeys: ['emdAmount'],
    ruleType: 'near_label',
    description: 'EMD must appear near EMD / Earnest Money Deposit / Bid Security labels',
    nearLabels: [...PARAMETER_VALIDATION_RULES.emdAmount.nearLabels],
  },
  {
    id: 'date_format',
    parameterKeys: [
      'publishingDate',
      'preBidMeetingDate',
      'bidStartDate',
      'bidEndDate',
      'technicalBidDate',
      'financialBidDate',
    ],
    ruleType: 'date',
    description: PARAMETER_VALIDATION_RULES.dates.description,
  },
  {
    id: 'completion_period_numeric',
    parameterKeys: ['completionPeriod', 'contractPeriod'],
    ruleType: 'period',
    description: PARAMETER_VALIDATION_RULES.completionPeriod.description,
  },
  {
    id: 'turnover_financial',
    parameterKeys: ['turnoverRequirement', 'netWorthRequirement', 'bidCapacity'],
    ruleType: 'currency',
    description: 'Turnover / financial eligibility must be a valid monetary amount',
  },
  {
    id: 'experience_duration',
    parameterKeys: ['experienceRequirement'],
    ruleType: 'text',
    description: 'Experience must contain duration, project value, or similar work description',
  },
  {
    id: 'dynamic_quality',
    parameterNames: ['*'],
    ruleType: 'quality',
    description: 'Dynamic parameters must pass quality checks — no OCR garbage, headers, or checklist content',
  },
];

export function formatValidationRulesForPrompt(): string {
  return VALIDATION_RULE_REGISTRY.map((r) => `- ${r.id}: ${r.description}`).join('\n');
}
