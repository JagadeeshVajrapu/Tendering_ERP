import {
  ContextValidationRule,
  LogicValidationRule,
  ValueTypeRule,
} from '../../types/enterpriseTenderValidation';
import { MasterDatasetKey } from '../../types/masterDataset';

export const ENTERPRISE_VALUE_TYPE_RULES: ValueTypeRule[] = [
  {
    parameterKeys: [
      'tenderValue',
      'estimatedCost',
      'emdAmount',
      'documentFee',
      'performanceSecurity',
      'bankGuarantee',
      'turnoverRequirement',
      'netWorthRequirement',
      'bidCapacity',
    ],
    valueType: 'currency',
  },
  {
    parameterKeys: [
      'publishingDate',
      'preBidMeetingDate',
      'bidStartDate',
      'bidEndDate',
      'technicalBidDate',
      'financialBidDate',
    ],
    valueType: 'date',
  },
  {
    parameterKeys: ['completionPeriod', 'contractPeriod'],
    valueType: 'period',
  },
];

export const ENTERPRISE_CONTEXT_RULES: ContextValidationRule[] = [
  {
    parameterKeys: ['tenderValue', 'estimatedCost'],
    nearLabels: [
      'tender value',
      'estimated cost',
      'project cost',
      'contract value',
      'estimated tender value',
      'work value',
    ],
    forbiddenLabels: ['turnover', 'experience', 'bank solvency', 'annual turnover'],
  },
  {
    parameterKeys: ['emdAmount'],
    nearLabels: ['emd', 'earnest money', 'bid security', 'earnest money deposit'],
    forbiddenLabels: ['performance guarantee', 'performance security', 'pbg', 'performance bank guarantee'],
  },
  {
    parameterKeys: ['turnoverRequirement'],
    nearLabels: ['turnover', 'annual turnover', 'average turnover', 'minimum turnover'],
  },
  {
    parameterKeys: ['experienceRequirement'],
    nearLabels: ['experience', 'similar work', 'past experience', 'work experience'],
  },
  {
    parameterKeys: ['bidEndDate'],
    nearLabels: ['bid end', 'last date', 'submission deadline', 'closing date', 'bid closing'],
    forbiddenLabels: ['pre bid', 'opening date', 'technical opening', 'financial opening', 'contract date'],
  },
];

export const ENTERPRISE_LOGIC_RULES: LogicValidationRule[] = [
  {
    id: 'bid_end_after_start',
    description: 'Bid End Date must occur after Bid Start Date',
    check: 'date_after',
    leftKey: 'bidEndDate',
    rightKey: 'bidStartDate',
  },
  {
    id: 'financial_after_technical',
    description: 'Financial Bid Opening must occur after Technical Bid Opening',
    check: 'date_after',
    leftKey: 'financialBidDate',
    rightKey: 'technicalBidDate',
  },
  {
    id: 'tender_value_not_turnover',
    description: 'Tender Value cannot equal Turnover Requirement',
    check: 'value_not_equal',
    leftKey: 'tenderValue',
    rightKey: 'turnoverRequirement',
  },
  {
    id: 'emd_not_performance_security',
    description: 'EMD cannot equal Performance Security',
    check: 'value_not_equal',
    leftKey: 'emdAmount',
    rightKey: 'performanceSecurity',
  },
];

const COUNT_PARAM_RX =
  /\b(count|nos\.?|number\s+of|quantity|strength|deployment|manpower|guards?|staff|vehicles?|machines?)\b/i;

const PERCENT_PARAM_RX = /\b(percent|percentage|%\s*requirement|margin|rate)\b/i;

export function inferDynamicValueType(parameter: string): 'percentage' | 'count' | 'text' {
  const p = parameter.toLowerCase();
  if (PERCENT_PARAM_RX.test(p) || p.includes('%')) return 'percentage';
  if (COUNT_PARAM_RX.test(p)) return 'count';
  return 'text';
}

export function getValueTypeForKey(key?: string): ValueTypeRule['valueType'] | undefined {
  if (!key) return undefined;
  const rule = ENTERPRISE_VALUE_TYPE_RULES.find((r) =>
    r.parameterKeys.includes(key as MasterDatasetKey)
  );
  return rule?.valueType;
}

export function getContextRuleForKey(key?: string): ContextValidationRule | undefined {
  if (!key) return undefined;
  return ENTERPRISE_CONTEXT_RULES.find((r) => r.parameterKeys.includes(key as MasterDatasetKey));
}
