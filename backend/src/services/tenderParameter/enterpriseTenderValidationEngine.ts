import { MasterDatasetKey } from '../../types/masterDataset';
import {
  EnterpriseValidationBatchResult,
  EnterpriseValidationLayerResult,
  EnterpriseValidationResult,
  EnterpriseValidationStatus,
  EnterpriseValidatedCandidate,
} from '../../types/enterpriseTenderValidation';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { normalizeAliasKey } from './tenderParameterAliasEngine';
import { isAllowedMasterParameter, isNitAllowedDatasetKey } from './masterTenderParameterDictionaryEngine';
import {
  isCurrencyValue,
  isNumericPeriodValue,
  isValidAmountValue,
  isValidDateValue,
} from './parameterValidationRules';
import {
  ENTERPRISE_CONTEXT_RULES,
  ENTERPRISE_LOGIC_RULES,
  ENTERPRISE_VALUE_TYPE_RULES,
  getContextRuleForKey,
  getValueTypeForKey,
  inferDynamicValueType,
} from './enterpriseValidationRuleRegistry';
import {
  isContractClauseLabel,
  isGarbageTenderParameterLabel,
  isGarbageTenderParameterValue,
  isGenuineTenderParameterRow,
  passesExtendedTenderParameterQuality,
  rowResolvesAsCoreParameter,
} from './tenderParameterQualityEngine';
import {
  resolveStrictParameterKind,
  validateStrictParameterValue,
  getStrictValueValidationRuleSummary,
  StrictValidationStatus,
} from './strictValueValidationEngine';
import {
  computeEnterpriseValidationConfidence,
  getValidationConfidenceRuleSummary,
  resolveSectionMatchType,
} from './enterpriseValidationConfidenceEngine';
import { matchesTenderTypeLibraryParameter } from '../tenderIntelligence/enterpriseTenderTypeLibraryEngine';
const PLACEHOLDER_VALUE_RX =
  /\b(xxxx|xxx|tbd|tba|n\/a|na|nil|none|not\s+available|not\s+applicable|to\s+be\s+(?:advised|filled|decided))\b/i;

const GARBAGE_VALUE_RX =
  /^(?:delhi|mathura|new\s+delhi|mumbai|chennai|kolkata|bangalore|hyderabad|pune|india|check\s*l?|l\s*ist|index)$/i;

function isOcrGarbageValue(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (GARBAGE_VALUE_RX.test(v)) return true;
  if (PLACEHOLDER_VALUE_RX.test(v)) return true;
  if (/x{3,}/i.test(v.replace(/\s/g, ''))) return true;
  return false;
}

const HEADER_FOOTER_RX =
  /\b(page\s+(no\.?|number)|printed\s+on|generated\s+on|digitally\s+signed|confidential|footer|header)\b/i;

const CHECKLIST_RX =
  /\b(checklist|annexure|appendix|declaration\s+form|integrity\s+pact|table\s+of\s+contents)\b/i;

const PERCENT_VALUE_RX = /%/;
const COUNT_VALUE_RX = /\d+/;

function nearContext(row: TenderParameterCandidateRow): string {
  return normalizeAliasKey(`${row.originalLabel || ''} ${row.parameter} ${row.sourceText}`);
}

function layerResult(
  layer: EnterpriseValidationLayerResult['layer'],
  status: EnterpriseValidationLayerResult['status'],
  reason: string,
  rule?: string
): EnterpriseValidationLayerResult {
  return { layer, status, reason, rule };
}

function worstStatus(
  current: EnterpriseValidationStatus,
  incoming: EnterpriseValidationStatus | 'PASS'
): EnterpriseValidationStatus {
  if (incoming === 'PASS') return current;
  if (incoming === 'REJECT') return 'REJECT';
  if (current === 'REJECT') return 'REJECT';
  if (incoming === 'REVIEW' || current === 'REVIEW') return 'REVIEW';
  if (current === 'VALID_DYNAMIC_PARAMETER' || incoming === 'VALID_DYNAMIC_PARAMETER') {
    return current === 'VALID' ? 'VALID' : 'VALID_DYNAMIC_PARAMETER';
  }
  return incoming;
}

function validateLayer1Parameter(row: TenderParameterCandidateRow): EnterpriseValidationLayerResult {
  const label = (row.originalLabel || row.parameter || '').trim();

  if (isContractClauseLabel(label)) {
    return layerResult('parameter', 'REJECT', 'Contract clause or sentence fragment — not a parameter label', 'clause_label');
  }

  const isCore = rowResolvesAsCoreParameter(row);
  if (!isCore && !isGenuineTenderParameterRow(row)) {
    return layerResult('parameter', 'REJECT', 'Not a genuine tender parameter (page header, form, or prose)', 'not_genuine_parameter');
  }

  if (isGarbageTenderParameterLabel(label)) {
    return layerResult('parameter', 'REJECT', 'Unknown OCR noise or broken label', 'garbage_label');
  }

  const ctx = nearContext(row);
  if (HEADER_FOOTER_RX.test(ctx)) {
    return layerResult('parameter', 'REJECT', 'Header or footer text', 'header_footer');
  }
  if (CHECKLIST_RX.test(ctx) && !passesExtendedTenderParameterQuality(row)) {
    return layerResult('parameter', 'REJECT', 'Checklist or annexure boilerplate without genuine value', 'checklist_context');
  }
  if (CHECKLIST_RX.test(ctx) && passesExtendedTenderParameterQuality(row)) {
    return layerResult('parameter', 'VALID_DYNAMIC_PARAMETER', 'Genuine parameter in annexure/checklist context');
  }

  if (isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
    return layerResult('parameter', 'PASS', 'Known master dictionary parameter');
  }

  if (passesExtendedTenderParameterQuality(row)) {
    return layerResult('parameter', 'VALID_DYNAMIC_PARAMETER', 'Genuine dynamic tender parameter');
  }

  return layerResult('parameter', 'REVIEW', 'Unknown parameter — needs review', 'unknown_parameter');
}

function validateLayer2StrictValue(row: TenderParameterCandidateRow): EnterpriseValidationLayerResult | null {
  const kind = resolveStrictParameterKind(row.canonicalKey, row.parameter);
  if (!kind) return null;

  const result = validateStrictParameterValue(kind, row.value?.trim() || '', nearContext(row));
  if (result.status === 'VALID') {
    return layerResult('value', 'PASS', result.reason, result.rule);
  }
  return layerResult('value', result.status, result.reason, result.rule);
}

function validateLayer2Value(row: TenderParameterCandidateRow): EnterpriseValidationLayerResult {
  const value = row.value?.trim() || '';

  if (!value || value.length < 1) {
    return layerResult('value', 'REJECT', 'Empty value — OCR garbage', 'empty_value');
  }

  if (isOcrGarbageValue(value)) {
    return layerResult('value', 'REJECT', 'OCR garbage or placeholder value', 'garbage_value');
  }

  const strict = validateLayer2StrictValue(row);
  if (strict) return strict;

  const key = row.canonicalKey as MasterDatasetKey | undefined;
  const valueType = getValueTypeForKey(key) ?? inferDynamicValueType(row.parameter);

  switch (valueType) {
    case 'currency': {
      if (isCurrencyValue(value) || isValidAmountValue(value)) {
        return layerResult('value', 'PASS', 'Valid currency format');
      }
      return layerResult('value', 'REJECT', 'Currency field — invalid amount format', 'currency_invalid');
    }
    case 'date': {
      if (isValidDateValue(value)) return layerResult('value', 'PASS', 'Valid date format');
      if (/\d{1,2}[\s./-]\d{1,2}/.test(value) || /\d{4}/.test(value)) {
        return layerResult('value', 'REVIEW', 'Date format unclear — needs review', 'date_review');
      }
      return layerResult('value', 'REJECT', 'Date field — invalid format', 'date_invalid');
    }
    case 'period': {
      if (isNumericPeriodValue(value)) return layerResult('value', 'PASS', 'Valid period');
      if (COUNT_VALUE_RX.test(value)) {
        return layerResult('value', 'REVIEW', 'Period value missing unit — needs review', 'period_review');
      }
      return layerResult('value', 'REJECT', 'Period field — invalid duration format', 'period_invalid');
    }
    case 'percentage': {
      if (PERCENT_VALUE_RX.test(value)) return layerResult('value', 'PASS', 'Valid percentage');
      if (/\d+/.test(value)) {
        return layerResult('value', 'REVIEW', 'Percentage without % symbol — preserved for review', 'percentage_review');
      }
      return layerResult('value', 'REVIEW', 'Percentage field — format needs review', 'percentage_review');
    }
    case 'count': {
      if (COUNT_VALUE_RX.test(value)) return layerResult('value', 'PASS', 'Valid numeric count');
      return layerResult('value', 'REVIEW', 'Count value preserved for review', 'count_review');
    }
    default: {
      const isCore = isAllowedMasterParameter(row.parameter, row.canonicalKey);
      if (isGarbageTenderParameterValue(value, { isCore })) {
        return layerResult('value', 'REJECT', 'Prose paragraph or form boilerplate — not a parameter value', 'prose_value');
      }
      if (value.length >= 2 && value.length <= (isCore ? 1200 : 350)) {
        return layerResult('value', 'PASS', 'Text value accepted');
      }
      return layerResult('value', 'REVIEW', 'Text value preserved for review', 'text_review');
    }
  }
}

function validateLayer3Context(row: TenderParameterCandidateRow): EnterpriseValidationLayerResult {
  const key = row.canonicalKey as MasterDatasetKey | undefined;
  const rule = getContextRuleForKey(key);
  if (!rule) return layerResult('context', 'PASS', 'No strict context rule');

  const ctx = nearContext(row);
  const rankScore = row.rankScore ?? 0;

  if (rule.forbiddenLabels?.some((l) => ctx.includes(normalizeAliasKey(l)))) {
    const hasAllowed = rule.nearLabels.some((l) => ctx.includes(normalizeAliasKey(l)));
    if (!hasAllowed) {
      return layerResult('context', 'REVIEW', 'Value in ambiguous context — preserved for review', 'forbidden_context');
    }
  }

  const hasNear = rule.nearLabels.some((l) => ctx.includes(normalizeAliasKey(l)));
  if (hasNear) return layerResult('context', 'PASS', 'Correct label context');

  if (rankScore >= 65 || (row.confidence ?? 0) >= 85) {
    return layerResult('context', 'REVIEW', 'Context weak but ranking/confidence supports review', 'weak_context_review');
  }

  return layerResult('context', 'REVIEW', 'Missing expected label context', 'missing_context');
}

function parseLooseDate(value: string): number | null {
  const v = value.trim();
  const dmy = v.match(/\b(\d{1,2})[\s./-](\d{1,2})[\s./-](\d{2,4})\b/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const months = v.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i);
  if (months) {
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const m = monthMap[months[2].slice(0, 3).toLowerCase()];
    if (m === undefined) return null;
    const year = months[3].length === 2 ? 2000 + Number(months[3]) : Number(months[3]);
    return Date.UTC(year, m, Number(months[1]));
  }
  return null;
}

function normalizeComparableValue(value: string): string {
  return value.replace(/[^\d]/g, '');
}

function validateLayer4Logic(
  row: TenderParameterCandidateRow,
  valueByKey: Map<string, string>
): EnterpriseValidationLayerResult {
  const key = row.canonicalKey as MasterDatasetKey | undefined;
  if (!key) return layerResult('logic', 'PASS', 'No logic rules for dynamic parameter');

  for (const rule of ENTERPRISE_LOGIC_RULES) {
    if (rule.leftKey !== key) continue;

    const leftVal = valueByKey.get(rule.leftKey) ?? row.value;
    const rightVal = valueByKey.get(rule.rightKey);
    if (!rightVal) continue;

    if (rule.check === 'value_not_equal') {
      if (normalizeComparableValue(leftVal) === normalizeComparableValue(rightVal) && normalizeComparableValue(leftVal).length >= 3) {
        return layerResult('logic', 'REJECT', rule.description, rule.id);
      }
      continue;
    }

    if (rule.check === 'date_after') {
      const leftDate = parseLooseDate(leftVal);
      const rightDate = parseLooseDate(rightVal);
      if (leftDate != null && rightDate != null && leftDate <= rightDate) {
        return layerResult('logic', 'REVIEW', rule.description, rule.id);
      }
    }
  }

  return layerResult('logic', 'PASS', 'Tender logic checks passed');
}

function validateLayer5Cross(
  row: TenderParameterCandidateRow,
  allCandidates: TenderParameterCandidateRow[]
): { layer: EnterpriseValidationLayerResult; confidenceBoost: number } {
  const paramKey = normalizeAliasKey(row.canonicalKey || row.parameter);
  const valueKey = normalizeAliasKey(row.value);
  let repeats = 0;

  for (const c of allCandidates) {
    const ck = normalizeAliasKey(c.canonicalKey || c.parameter);
    if (ck === paramKey && normalizeAliasKey(c.value) === valueKey) repeats += 1;
  }

  if (repeats >= 2) {
    return {
      layer: layerResult('cross', 'PASS', `Same value repeated on ${repeats} pages — confidence boosted`),
      confidenceBoost: Math.min(15, repeats * 5),
    };
  }

  return { layer: layerResult('cross', 'PASS', 'Single occurrence'), confidenceBoost: 0 };
}

function combineLayers(
  row: TenderParameterCandidateRow,
  layers: EnterpriseValidationLayerResult[],
  confidenceBoost: number,
  formatStatus: StrictValidationStatus | 'PASS' | 'NONE' = 'NONE',
  opts?: { tenderType?: string }
): EnterpriseValidationResult {
  let status: EnterpriseValidationStatus = 'VALID';
  const reasons: string[] = [];
  let validationRule: string | undefined;

  for (const l of layers) {
    if (l.layer === 'parameter' && l.status === 'VALID_DYNAMIC_PARAMETER') {
      status = 'VALID_DYNAMIC_PARAMETER';
      reasons.push(l.reason);
      continue;
    }
    status = worstStatus(status, l.status as EnterpriseValidationStatus | 'PASS');
    if (l.status !== 'PASS' && l.status !== 'VALID' && l.status !== 'VALID_DYNAMIC_PARAMETER') {
      if (l.status === 'REJECT') validationRule = l.rule || validationRule;
      reasons.push(l.reason);
    } else if (l.status === 'PASS' && l.layer === 'value' && l.reason) {
      reasons.push(l.reason);
    } else if (l.reason && l.layer !== 'parameter') {
      reasons.push(l.reason);
    }
  }

  if (status === 'VALID' && !isAllowedMasterParameter(row.parameter, row.canonicalKey)) {
    status = 'VALID_DYNAMIC_PARAMETER';
  }

  const { confidence: computedConfidence } = computeEnterpriseValidationConfidence(row, {
    formatStatus,
    sectionMatchType: resolveSectionMatchType(row),
    tenderTypeMatch: opts?.tenderType
      ? matchesTenderTypeLibraryParameter(row.parameter, opts.tenderType)
      : false,
  });

  const confidence = Math.min(
    100,
    Math.round(computedConfidence + confidenceBoost * 0.5 + (row.rankScore || 0) * 0.1)
  );

  const primaryReason =
    layers.find((l) => l.layer === 'value' && l.status === 'PASS')?.reason ||
    layers.find((l) => l.layer === 'value' && l.status === 'VALID')?.reason ||
    reasons[0] ||
    'Passed enterprise validation';

  if (status === 'REVIEW') {
    return {
      parameter: row.parameter,
      value: row.value,
      validationStatus: 'REVIEW',
      confidence,
      reason: reasons.join('; ') || primaryReason,
      isDynamicParameter: !isAllowedMasterParameter(row.parameter, row.canonicalKey),
      validationRule,
      layers,
    };
  }

  if (status === 'REJECT') {
    return {
      parameter: row.parameter,
      value: row.value,
      validationStatus: 'REJECT',
      confidence: Math.round(confidence * 0.4),
      reason: reasons.join('; ') || 'Rejected by validation',
      isDynamicParameter: !isAllowedMasterParameter(row.parameter, row.canonicalKey),
      validationRule,
      layers,
    };
  }

  const finalStatus: EnterpriseValidationStatus =
    status === 'VALID_DYNAMIC_PARAMETER' ? 'VALID_DYNAMIC_PARAMETER' : 'VALID';

  return {
    parameter: row.parameter,
    value: row.value,
    validationStatus: finalStatus,
    confidence,
    reason: primaryReason,
    isDynamicParameter: finalStatus === 'VALID_DYNAMIC_PARAMETER',
    validationRule,
    layers,
  };
}

export function validateEnterpriseTenderCandidate(
  row: TenderParameterCandidateRow,
  opts?: {
    allCandidates?: TenderParameterCandidateRow[];
    valueByKey?: Map<string, string>;
    tenderType?: string;
  }
): EnterpriseValidationResult {
  const valueByKey = opts?.valueByKey ?? new Map<string, string>();
  if (row.canonicalKey && isNitAllowedDatasetKey(row.canonicalKey as MasterDatasetKey)) {
    valueByKey.set(row.canonicalKey, row.value);
  }

  const l1 = validateLayer1Parameter(row);
  if (l1.status === 'REJECT') {
    return combineLayers(row, [l1], 0, 'NONE', { tenderType: opts?.tenderType });
  }

  const l2 = validateLayer2Value(row);
  const l3 = validateLayer3Context(row);
  const l4 = validateLayer4Logic(row, valueByKey);
  const { layer: l5, confidenceBoost } = validateLayer5Cross(row, opts?.allCandidates ?? [row]);

  const strictKind = resolveStrictParameterKind(row.canonicalKey, row.parameter);
  let formatStatus: StrictValidationStatus | 'PASS' | 'NONE' = 'NONE';
  if (strictKind) {
    const strict = validateStrictParameterValue(strictKind, row.value?.trim() || '', nearContext(row));
    formatStatus = strict.status;
  } else if (l2.status === 'PASS') {
    formatStatus = 'PASS';
  } else if (l2.status === 'REVIEW') {
    formatStatus = 'REVIEW';
  }

  return combineLayers(row, [l1, l2, l3, l4, l5], confidenceBoost, formatStatus, {
    tenderType: opts?.tenderType,
  });
}

export function validateEnterpriseTenderCandidates(
  winners: TenderParameterCandidateRow[],
  opts?: { allCandidates?: TenderParameterCandidateRow[]; tenderType?: string }
): EnterpriseValidationBatchResult {
  const allCandidates = opts?.allCandidates ?? winners;

  const valueByKey = new Map<string, string>();
  for (const row of winners) {
    if (row.canonicalKey && row.value?.trim()) {
      valueByKey.set(row.canonicalKey, row.value);
    }
  }

  const storable: EnterpriseValidatedCandidate[] = [];
  const rejected: EnterpriseValidatedCandidate[] = [];
  const rejectionLog: EnterpriseValidationBatchResult['rejectionLog'] = [];

  let reviewCount = 0;
  let dynamicCount = 0;
  let rejectedByContext = 0;
  let rejectedByDate = 0;
  let rejectedByAmount = 0;
  let rejectedByPeriod = 0;
  let rejectedByLogic = 0;

  for (const row of winners) {
    const result = validateEnterpriseTenderCandidate(row, { allCandidates, valueByKey, tenderType: opts?.tenderType });
    const enriched: EnterpriseValidatedCandidate = {
      ...row,
      confidence: result.confidence,
      validationStatus: result.validationStatus,
      validationPassed: result.validationStatus !== 'REJECT',
      validationReason: result.reason,
      validationRule: result.validationRule,
      validationConfidence: result.confidence,
      isDynamicParameter: result.isDynamicParameter,
    };

    if (result.validationStatus === 'REJECT') {
      rejected.push(enriched);
      rejectionLog.push({
        parameter: row.parameter,
        value: row.value,
        reason: result.reason,
        page: row.page,
        validationRule: result.validationRule,
        timestamp: new Date().toISOString(),
      });

      const rule = result.validationRule || '';
      if (rule.includes('context') || rule === 'forbidden_context') rejectedByContext += 1;
      else if (rule.includes('date')) rejectedByDate += 1;
      else if (rule.includes('currency') || rule.includes('amount')) rejectedByAmount += 1;
      else if (rule.includes('period')) rejectedByPeriod += 1;
      else if (rule.includes('bid_') || rule.includes('not_')) rejectedByLogic += 1;
      continue;
    }

    if (result.validationStatus === 'REVIEW') reviewCount += 1;
    if (result.validationStatus === 'VALID_DYNAMIC_PARAMETER') dynamicCount += 1;
    storable.push(enriched);
  }

  return {
    storable,
    rejected,
    rejectionLog,
    stats: {
      inputCount: winners.length,
      validCount: storable.filter((s) => s.validationStatus === 'VALID').length,
      reviewCount,
      dynamicCount,
      rejectedCount: rejected.length,
      rejectedByContext,
      rejectedByDate,
      rejectedByAmount,
      rejectedByPeriod,
      rejectedByLogic,
    },
  };
}

/** Backward-compatible wrappers */
export function validateTenderParameterCandidates(winners: TenderParameterCandidateRow[]) {
  const batch = validateEnterpriseTenderCandidates(winners);
  return {
    valid: batch.storable,
    rejected: batch.rejected,
    stats: {
      inputCount: batch.stats.inputCount,
      validCount: batch.storable.length,
      rejectedCount: batch.stats.rejectedCount,
      rejectedByContext: batch.stats.rejectedByContext,
      rejectedByDate: batch.stats.rejectedByDate,
      rejectedByAmount: batch.stats.rejectedByAmount,
      rejectedByPeriod: batch.stats.rejectedByPeriod,
    },
  };
}

export function validateDynamicParameterCandidates(winners: TenderParameterCandidateRow[]) {
  return validateTenderParameterCandidates(winners);
}

export function getEnterpriseValidationRuleSummary() {
  const strictRules = getStrictValueValidationRuleSummary();
  const confidenceRules = getValidationConfidenceRuleSummary();
  return {
    engine: 'enterprise_validation_engine',
    valueTypeRules: ENTERPRISE_VALUE_TYPE_RULES,
    contextRules: ENTERPRISE_CONTEXT_RULES,
    logicRules: ENTERPRISE_LOGIC_RULES.map((r) => ({
      id: r.id,
      description: r.description,
      check: r.check,
      leftKey: r.leftKey,
      rightKey: r.rightKey,
    })),
    statuses: ['VALID', 'REVIEW', 'REJECT', 'VALID_DYNAMIC_PARAMETER'],
    masterDatasetStores: ['VALID', 'REVIEW', 'VALID_DYNAMIC_PARAMETER'],
    masterDatasetRejects: ['REJECT'],
    strictValueValidation: strictRules,
    confidenceCalculation: confidenceRules,
    outputShape: {
      parameter: '',
      value: '',
      status: 'VALID | REVIEW | REJECT',
      confidence: 95,
      validationReason: 'Passed Financial Validation',
    },
  };
}
