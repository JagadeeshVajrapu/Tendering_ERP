import { resolveRuleForParameter, normalizeParameterNameForMapping } from '../parameterMapping/businessFieldMappingRegistry';

const TENDER_TOPIC =
  /\b(tender|nit|notice|inviting|emd|earnest|bid|security|deposit|fee|work|scope|eligibility|contract|agreement|period|manpower|turnover|experience|equipment|organization|organisation|authority|department|email|e-mail|phone|mobile|fax|cost|value|reference|submission|opening|meeting|completion|performance|guarantee|certificate|document|gst|pan|iso|msme)\b/i;

const NOISE_PARAMETER =
  /(?:\b(?:road|quarter|staff|bagh|maharani|mathura|pin\s*code|pincode|delhi|new\s+delhi|industrial\s+research|council\s+of\s+scientific)\b|^\s*\d{5,6}\s*\.?\s*$|page\s*\d|tender\s+document\s+for|^ii\s+page)/i;

const NOISE_VALUE_ONLY_ADDRESS = /^(?:\d{5,6}\.?|mathura|new\s+delhi)$/i;

/** Known OCR label phrases — always keep when paired with a real value. */
const KNOWN_TENDER_LABELS =
  /^(?:tender\s*(?:no\.?|number|id|name|title)|nit\s*(?:no\.?|number)|bid\s*(?:no\.?|number|reference)|name\s+of\s+work|work\s+name|scope\s+of\s+work|nature\s+of\s+work|description\s+of\s+work|emd|earnest\s+money|tender\s+value|estimated\s+cost|document\s+fee|tender\s+fee|organization|organisation|issuing\s+authority|eligibility|contract\s+period|completion\s+period|bid\s+(?:start|end|opening|submission)|last\s+date|pre\s*-?\s*bid|contact|email|phone|mobile|manpower|turnover|experience)$/i;

export function mapsToBusinessField(parameterName: string): boolean {
  return resolveRuleForParameter(normalizeParameterNameForMapping(parameterName)) !== null;
}

export function isKnownTenderLabel(parameterName: string): boolean {
  const n = parameterName.replace(/\s+/g, ' ').trim();
  if (KNOWN_TENDER_LABELS.test(n)) return true;
  return mapsToBusinessField(parameterName);
}

export function isNoiseParameter(parameterName: string, parameterValue: string): boolean {
  const name = parameterName.replace(/\s+/g, ' ').trim();
  const value = parameterValue.replace(/\s+/g, ' ').trim();

  if (!name || !value) return true;
  if (name.length > 100) return true;
  if (NOISE_VALUE_ONLY_ADDRESS.test(value) && !TENDER_TOPIC.test(name)) return true;
  if (NOISE_PARAMETER.test(name) && !TENDER_TOPIC.test(name)) return true;

  if (name.length > 45 && !TENDER_TOPIC.test(name)) return true;

  const upperRatio = (name.match(/[A-Z]/g)?.length ?? 0) / Math.max(name.replace(/\s/g, '').length, 1);
  if (name.length > 25 && upperRatio > 0.85 && !TENDER_TOPIC.test(name)) return true;

  if (/^\d+[\.\)]\s/.test(name) && !TENDER_TOPIC.test(name)) return true;

  return false;
}

/** Keep parameters that map to business fields or look like real tender labels. */
export function isTenderRelevantParameter(parameterName: string, parameterValue: string): boolean {
  if (isNoiseParameter(parameterName, parameterValue)) return false;
  if (isKnownTenderLabel(parameterName)) return true;
  if (mapsToBusinessField(parameterName)) return true;

  const name = parameterName.replace(/\s+/g, ' ').trim();
  if (name.length <= 35 && TENDER_TOPIC.test(name)) return true;

  return false;
}
