import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { classifyParameterGroup } from '../parameterDiscovery/parameterGroupingEngine';
import { ProfessionalNitCategory } from '../nit/professionalNitAnalysisSections';
import {
  isAllowedMasterParameter,
  isNitAllowedDatasetKey,
  normalizeParamName,
} from './masterTenderParameterDictionaryEngine';
import { resolveEnterpriseAlias } from './enterpriseTenderAliasEngine';
import { rejectBusinessIrrelevantDynamicParameter } from './businessRelevantDynamicParameterEngine';

const GARBAGE_LABEL_RX =
  /^(?:delhi|mathura|mumbai|chennai|kolkata|bangalore|hyderabad|pune|india|new\s+delhi|ii\s+page|page\s+\d|check\s*l?|particulars|sl\.?\s*no|sr\.?\s*no|index|annexure|declaration|integrity\s+pact|table\s+of\s+contents|schedule\s+[a-z]|enclosure|complaint\s+form|register|triplicate|proforma)$/i;

const GARBAGE_LABEL_CONTAINS_RX =
  /\b(ii\s+page\s+\d|page\s+\d+\s+of\s+\d|page\s+\d\s+e\b|index\s+name\s+of\s+work|abolition\)\s+act|identification\s+numbered|assistant\s+engin|engineer\s*-\s*in\s*-\s*charge|enclosure\s+[ivxlc]+|complaint\s+form|maintenance\s+of\s+complaint)\b/i;

const PAGE_HEADER_LABEL_RX = /^\s*page\s+\d+/i;

const TENDER_LABEL_HINT_RX =
  /\b(tender|bid|emd|earnest|nit|work|fee|date|amount|security|deposit|period|eligibility|qualification|experience|turnover|guarantee|organization|organisation|department|scope|manpower|service|contract|submission|opening|closing|validity|gst|pan|msme|iso|location|address|contact|telephone|phone|email|website|officer|authority|number|no\.?|cost|value|estimated|performance|completion|technical|financial|pre\s*bid|publishing|document|solvency|net\s*worth|capacity|labour|license|licence|certificate|warranty|penalty|payment|tax|reverse\s*auction|maf|geM|eproc|oem|psara|gardener|housekeeping|machinery|vehicle|fuel|concrete|defect|liability|amc|sla|cloud|data\s*center|drone|surveillance|authorization|authorisation|staff|guard|count|requirement|duration|grade|certification|tractor|horsepower|hp|pto|engine|model|make|specification|qty|quantity|unit|delivery|bank|bg|pbg|benefit|condition|criteria|compliance|drawbar|hydraulic|lifting|payload|rating|brand|manufacturer|supply|goods|item|description|name\s+of\s+work|estimated\s+cost|tender\s+value|bid\s+validity|completion|commencement)\b/i;

const GARBAGE_VALUE_RX =
  /^(?:delhi|mathura|new\s+delhi|mumbai|chennai|kolkata|bangalore|hyderabad|pune|india|check\s*l?|l\s*ist|index)$/i;

const PLACEHOLDER_VALUE_RX =
  /\b(xxxx|xxx|tbd|tba|n\/a|na|nil|none|not\s+available|not\s+applicable|to\s+be\s+(?:advised|filled|decided))\b/i;

const PROSE_VALUE_RX =
  /\b(shall\s+be|contractor\s+shall|bidder\s+shall|supplier\s+shall|no\s+extra\s+payment|responsibility\s+of|will\s+be\s+the|photocopy\s+of|prescribed\s+proforma|to\s+be\s+submitted\s+along|balance\s+quantity|empty\s+drums|field\s+staff|allottee|splashes|mortars\s+droppings|in\s+accordance\s+with|subject\s+to\s+the|notwithstanding|hereinafter|whereas|provided\s+that|without\s+prejudice|aforesaid|aforementioned)\b/i;

const CLAUSE_LABEL_START_RX =
  /^(?:the|in|all|any|no|each|every|contractor|bidder|supplier|tenderer|employer|purchaser|notwithstanding|whereas|subject\s+to|during|upon|after|before|if|unless|when|while)\b/i;

const CLAUSE_LABEL_VERB_RX =
  /\b(shall|must|will\s+be|should\s+be|may\s+be|is\s+required|are\s+required|has\s+to|have\s+to|provided\s+that|in\s+accordance|as\s+per|hereby|thereof|therein|hereunder)\b/i;

const NUMBERED_CLAUSE_LABEL_RX = /^\d+(?:\.\d+)*[\.\):]\s*\S/i;

const SENTENCE_FRAGMENT_LABEL_RX =
  /\b(which|who|whom|where|when|because|although|however|therefore|furthermore|moreover|accordingly)\b/i;

const TECH_SPEC_VALUE_RX =
  /\b(specification|dimensions|tolerance|material\s+grade|operating\s+conditions|technical\s+data\s+sheet|as\s+per\s+is\s*:|conforming\s+to|manufactured\s+by|make\s+and\s+model)\b/i;

const FORM_BOILERPLATE_RX =
  /\b(complaint\s+form\s*\(|triplicate\)|nature\s+of\s+complaint|employees['\u2019]?\s+state\s+insurance\s+corporation|maintenance\s+of\s+complaint\s+register|care\s+taker\s+with\s+seal)\b/i;

/** Max label length for dynamic (non-dictionary) parameters. */
export const MAX_DYNAMIC_PARAMETER_LABEL_LEN = 80;
/** Max value length for dynamic parameters shown in NIT. */
export const MAX_DYNAMIC_PARAMETER_VALUE_LEN = 350;
/** Max value length for core dictionary parameters. */
export const MAX_CORE_PARAMETER_VALUE_LEN = 1200;

const GROUP_TO_PROFESSIONAL: Record<string, ProfessionalNitCategory> = {
  'General Information': 'Identity',
  'Financial Information': 'Financial',
  'Important Dates': 'Timeline',
  'Eligibility Criteria': 'Eligibility',
  'Compliance Requirements': 'Compliance',
  'Technical Requirements': 'Technical',
  'Contact Information': 'Identity',
};

export function isPageHeaderOrEnclosureLabel(label: string): boolean {
  const trimmed = String(label || '').trim();
  if (!trimmed) return true;
  if (PAGE_HEADER_LABEL_RX.test(trimmed)) return true;
  if (GARBAGE_LABEL_CONTAINS_RX.test(trimmed)) return true;
  if (trimmed.length > MAX_DYNAMIC_PARAMETER_LABEL_LEN && !isAllowedMasterParameter(trimmed)) {
    return true;
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 12 && !isAllowedMasterParameter(trimmed)) return true;
  return false;
}

export function isContractClauseLabel(label: string): boolean {
  const trimmed = String(label || '').trim();
  if (!trimmed) return false;
  if (CLAUSE_LABEL_START_RX.test(trimmed)) return true;
  if (CLAUSE_LABEL_VERB_RX.test(trimmed)) return true;
  if (NUMBERED_CLAUSE_LABEL_RX.test(trimmed)) return true;
  if (SENTENCE_FRAGMENT_LABEL_RX.test(trimmed)) return true;
  if (trimmed.endsWith('.') && trimmed.split(/\s+/).length > 5) return true;
  return false;
}

export function isGarbageTenderParameterLabel(label: string): boolean {
  const trimmed = String(label || '').trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (isPageHeaderOrEnclosureLabel(trimmed)) return true;
  if (isContractClauseLabel(trimmed)) return true;
  if (trimmed.length > 140) return true;
  if (GARBAGE_LABEL_RX.test(trimmed)) return true;
  if (/^\d+[\.\)]\s*$/.test(trimmed)) return true;
  if (/^[\d.,\s₹Rs/-]+$/.test(trimmed)) return true;
  return false;
}

export function isGarbageTenderParameterValue(
  value: string,
  opts?: { isCore?: boolean }
): boolean {
  const v = String(value || '').trim();
  if (!v || v.length < 2) return true;
  if (GARBAGE_VALUE_RX.test(v)) return true;
  if (PLACEHOLDER_VALUE_RX.test(v)) return true;
  if (/x{3,}/i.test(v.replace(/\s/g, ''))) return true;

  const maxLen = opts?.isCore ? MAX_CORE_PARAMETER_VALUE_LEN : MAX_DYNAMIC_PARAMETER_VALUE_LEN;
  if (v.length > maxLen) return true;

  if (PROSE_VALUE_RX.test(v)) return true;
  if (FORM_BOILERPLATE_RX.test(v)) return true;
  if (!opts?.isCore && TECH_SPEC_VALUE_RX.test(v) && v.length > 80) return true;

  const numberedClauses = v.match(/\b\d+\.\s+/g);
  if (numberedClauses && numberedClauses.length >= 2) return true;

  const longSentences = v.split(/[.!?]/).filter((s) => s.trim().length > 50);
  if (longSentences.length >= 2 && !opts?.isCore) return true;

  if (!opts?.isCore && v.split(/\s+/).length > 45) return true;

  return false;
}

/** Trim duplicated label prefix and collapse multi-sentence prose into atomic value when possible. */
export function cleanExtractedParameterValue(value: string, parameter: string, isCore = false): string {
  let v = String(value || '').replace(/^\s+|\s+$/g, '');
  if (!v) return v;

  const param = String(parameter || '').trim();
  if (param && v.toLowerCase().startsWith(param.toLowerCase())) {
    v = v.slice(param.length).replace(/^[\s:–—-]+/, '').trim();
  }

  const labelColon = v.match(/^([^:]{2,80}):\s*(.+)$/);
  if (labelColon && labelColon[1].length <= 60 && labelColon[2].length >= 2) {
    const innerLabel = labelColon[1].trim();
    if (innerLabel.toLowerCase() !== param.toLowerCase() && !isAllowedMasterParameter(innerLabel)) {
      v = labelColon[2].trim();
    }
  }

  const maxLen = isCore ? MAX_CORE_PARAMETER_VALUE_LEN : MAX_DYNAMIC_PARAMETER_VALUE_LEN;
  if (!isCore && v.length > 120) {
    const firstPart = v.split(/\s*[.;]\s+/)[0]?.trim();
    if (firstPart && firstPart.length >= 2 && firstPart.length <= 120) {
      v = firstPart;
    }
  }

  if (v.length > maxLen) {
    v = v.slice(0, maxLen).trim();
  }

  return v;
}

export function isPlausibleTenderParameterLabel(label: string): boolean {
  if (isAllowedMasterParameter(label)) return true;
  if (isGarbageTenderParameterLabel(label)) return false;

  const norm = label.trim();
  if (!/[A-Za-z]{2,}/.test(norm)) return false;
  if (norm.length > MAX_DYNAMIC_PARAMETER_LABEL_LEN) return false;

  return TENDER_LABEL_HINT_RX.test(norm);
}

/** Whether label maps to master dictionary (after alias resolution). */
export function rowResolvesAsCoreParameter(row: TenderParameterCandidateRow): boolean {
  if (row.canonicalKey && isNitAllowedDatasetKey(row.canonicalKey)) return true;
  if (isAllowedMasterParameter(row.parameter, row.canonicalKey)) return true;

  const labels = [row.parameter, row.originalLabel].filter(Boolean) as string[];
  for (const label of labels) {
    const alias = resolveEnterpriseAlias(label);
    if (alias.canonicalKey && isNitAllowedDatasetKey(alias.canonicalKey)) return true;
    if (isAllowedMasterParameter(alias.normalizedParameter, alias.canonicalKey)) return true;
  }
  return false;
}

/** Early extraction gate — blocks obvious garbage only (before alias mapping). */
export function isExtractableCandidateRow(row: TenderParameterCandidateRow): boolean {
  const label = (row.originalLabel || row.parameter || '').trim();
  const value = (row.value || '').trim();
  if (!label || !value) return false;
  if (isGarbageTenderParameterLabel(label)) return false;
  if (isGarbageTenderParameterValue(value, { isCore: rowResolvesAsCoreParameter(row) })) return false;
  if (label.length > 140) return false;
  return true;
}

/**
 * Production gate: only genuine tender label→value pairs pass to master dataset / NIT.
 */
export function isGenuineTenderParameterRow(row: TenderParameterCandidateRow): boolean {
  const isCore = rowResolvesAsCoreParameter(row);
  const label = (row.originalLabel || row.parameter || '').trim();
  const value = (row.value || '').trim();

  if (!label || !value) return false;
  if (isGarbageTenderParameterLabel(label)) return false;
  if (isGarbageTenderParameterValue(value, { isCore })) return false;

  if (isContractClauseLabel(label)) return false;

  if (!isCore) {
    const businessReject = rejectBusinessIrrelevantDynamicParameter({
      parameter: label,
      value,
      sourceText: row.sourceText,
      page: row.page,
    });
    if (businessReject) return false;

    const alias = resolveEnterpriseAlias(label);
    const labelOk =
      isPlausibleTenderParameterLabel(label) ||
      (alias.aliasMatched && alias.aliasMatchScore >= 85);
    if (!labelOk) return false;
    if (label.toLowerCase() === value.toLowerCase()) return false;
    if (value.toLowerCase().startsWith(label.toLowerCase().slice(0, 24))) return false;
    if (value.split(/\s+/).length > 35) return false;
  }

  return true;
}

export function passesExtendedTenderParameterQuality(row: TenderParameterCandidateRow): boolean {
  return isGenuineTenderParameterRow(row);
}

export function classifyProfessionalCategory(
  parameter: string,
  value: string,
  dictionaryGroup?: string
): ProfessionalNitCategory {
  if (dictionaryGroup && dictionaryGroup in GROUP_TO_PROFESSIONAL) {
    return GROUP_TO_PROFESSIONAL[dictionaryGroup];
  }
  if (
    dictionaryGroup &&
    [
      'Identity',
      'Financial',
      'Timeline',
      'Eligibility',
      'Compliance',
      'Experience',
      'Scope',
      'Technical',
      'Tender Specific',
    ].includes(dictionaryGroup)
  ) {
    return dictionaryGroup as ProfessionalNitCategory;
  }

  return 'Identity';
}

export function extendedParameterKey(parameter: string): string {
  return `ext_${normalizeParamName(parameter).replace(/\s+/g, '_')}`;
}
