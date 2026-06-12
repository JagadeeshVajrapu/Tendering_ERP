import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { DYNAMIC_PARAMETER_REGISTRY } from '../../foundation/masterParameterRegistry';
import { matchStaticDynamicRegistry } from './dynamicParameterLearningRegistry';
import { normalizeAliasKey } from './enterpriseTenderAliasEngine';

/** Categories that qualify as business-relevant dynamic parameters. */
export const BUSINESS_RELEVANT_CATEGORIES = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Scope Of Work',
  'Technical',
  'Technical Requirements',
  'Tender Specific',
  'Tender Specific Requirements',
  'Manpower Requirements',
  'Security Requirements',
  'Procurement Requirements',
  'Contract Conditions',
  'Warranty Conditions',
  'Service Level Agreements',
  'Deployment Requirements',
] as const;

export type BusinessRelevantCategory = (typeof BUSINESS_RELEVANT_CATEGORIES)[number];

const CATEGORY_ALIASES: Record<string, BusinessRelevantCategory> = {
  identity: 'Identity',
  financial: 'Financial',
  timeline: 'Timeline',
  eligibility: 'Eligibility',
  compliance: 'Compliance',
  experience: 'Experience',
  scope: 'Scope',
  'scope of work': 'Scope Of Work',
  technical: 'Technical',
  'technical requirements': 'Technical Requirements',
  'tender specific': 'Tender Specific',
  'tender specific requirements': 'Tender Specific Requirements',
  'additional tender parameters': 'Tender Specific',
  'manpower requirements': 'Manpower Requirements',
  'security requirements': 'Security Requirements',
  'procurement requirements': 'Procurement Requirements',
  'contract conditions': 'Contract Conditions',
  'warranty conditions': 'Warranty Conditions',
  'service level agreements': 'Service Level Agreements',
  sla: 'Service Level Agreements',
  'deployment requirements': 'Deployment Requirements',
  'general information': 'Identity',
  'financial information': 'Financial',
  'important dates': 'Timeline',
  'eligibility criteria': 'Eligibility',
  'compliance requirements': 'Compliance',
};

const HEADING_ONLY_RX =
  /^(?:introduction|overview|background|preface|summary|general|particulars|details|description|scope|terms\s+and\s+conditions|conditions\s+of\s+contract|special\s+conditions|general\s+conditions|instructions\s+to\s+bidders?|bid\s+data\s+sheet|qualification\s+criteria|evaluation\s+criteria|submission\s+of\s+bids?|opening\s+of\s+bids?|award\s+of\s+contract|contract\s+form|schedule\s+of\s+rates?|bill\s+of\s+quantities?|boq|specifications?|drawings?|documents?\s+to\s+be\s+submitted|formats?|forms?|certificates?|declarations?)$/i;

const CLAUSE_NUMBER_LABEL_RX =
  /^(?:clause|section|article|para(?:graph)?|sub\s*clause|item|point)\s*(?:no\.?|number)?\s*[\divxlc]+[\.\):]?/i;

const NUMBERED_CLAUSE_ONLY_RX = /^\d+(?:\.\d+)*[\.\):]?\s*$/;

const ANNEXURE_REF_RX =
  /\b(?:annexure|appendix|enclosure|schedule|form\s+no\.?|format\s+no\.?)\s+[a-z0-9ivxlc]+(?:\s*[,;&]\s*(?:annexure|appendix|enclosure)\s+[a-z0-9ivxlc]+)*\b/i;

const ANNEXURE_ONLY_LABEL_RX =
  /^(?:annexure|appendix|enclosure|schedule|form|format)\s+[a-z0-9ivxlc]+\.?$/i;

const TOC_ENTRY_RX =
  /(?:^|\s)(?:table\s+of\s+contents|contents|index)(?:\s|$)|\.{3,}\s*\d+\s*$|^\d+(?:\.\d+)*\.?\s+\S.{2,90}\s+\d{1,3}\s*$/;

const CONTACT_BLOCK_RX =
  /\b(?:contact\s+(?:person|details|information|no\.?)|telephone|mobile|phone\s+no\.?|fax|e-?mail|email\s+id|website|web\s+site|www\.|@|pin\s*code|pincode)\b/i;

const CONTACT_ONLY_LABEL_RX =
  /^(?:contact|address|telephone|phone|mobile|email|e-mail|fax|website|pin\s*code|pincode)(?:\s+(?:person|details|information|no\.?|number|id))?\.?$/i;

const NAVIGATION_RX =
  /\b(?:go\s+to|click\s+here|back\s+to|next\s+page|previous\s+page|see\s+annexure|refer\s+annexure|as\s+per\s+annexure|vide\s+annexure|please\s+refer|kindly\s+refer)\b/i;

const NAVIGATION_ONLY_LABEL_RX =
  /^(?:refer|see|vide|as\s+per|please\s+refer|kindly\s+refer|contact\s+us|click\s+here)\b/i;

const PAGE_NUMBER_LABEL_RX =
  /^(?:page|pg\.?)\s*\d+(?:\s+of\s+\d+)?\.?$/i;

const SECTION_CHAPTER_REF_RX =
  /^(?:section|sec\.?|chapter|ch\.?)\s+[\divxlc.]+(?:\.\d+)*\.?$/i;

const CLAUSE_REF_ONLY_RX =
  /^(?:clause|cl\.?|article|para(?:graph)?)\s+[\d.]+(?:\.\d+)*\.?$/i;

const EMAIL_PHONE_LABEL_RX =
  /^(?:email|e-mail|email\s+address|mail\s+id|phone|mobile|telephone|contact\s+no\.?|tel\.?|fax\s+no\.?)$/i;

const EMAIL_VALUE_RX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_VALUE_RX =
  /^[\d\s+\-().]{7,18}$/;

const DOCUMENT_METADATA_RX =
  /\b(?:printed\s+on|generated\s+on|digitally\s+signed|confidential|document\s+id|doc\s+id|ref\s+no\.?)\b/i;

const REPEATED_TITLE_RX =
  /^(?:contents|index|table\s+of\s+contents|introduction|overview|summary|particulars)$/i;

const HEADER_FOOTER_LABEL_RX =
  /^(?:header|footer|page\s+header|page\s+footer)$/i;

const REPEATED_VALUE_RX = /^(.+)\1+$/;

export interface BusinessRelevanceInput {
  parameter: string;
  value: string;
  sourceText?: string;
  page?: number;
}

export function isAllowedBusinessCategory(category: string): category is BusinessRelevantCategory {
  return (BUSINESS_RELEVANT_CATEGORIES as readonly string[]).includes(category);
}

export function normalizeBusinessCategory(category: string): BusinessRelevantCategory {
  const key = String(category || '').trim().toLowerCase();
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  if (isAllowedBusinessCategory(category)) return category;
  return 'Tender Specific';
}

export function isRepeatedParameterText(value: string): boolean {
  const v = String(value || '').trim();
  if (!v || v.length < 6) return false;
  if (REPEATED_VALUE_RX.test(v.replace(/\s+/g, ''))) return true;

  const words = v.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(' ').toLowerCase();
    const second = words.slice(half).join(' ').toLowerCase();
    if (first === second) return true;
  }
  return false;
}

export function buildParameterFingerprint(row: BusinessRelevanceInput): string {
  const label = String(row.parameter || '').trim().toLowerCase();
  const value = String(row.value || '').trim().toLowerCase();
  return `${label}::${value}`;
}

/**
 * Rule-based gate: reject document noise before AI evaluation.
 * Returns a rejection reason, or null if the row may proceed to AI.
 */
export function rejectBusinessIrrelevantDynamicParameter(row: BusinessRelevanceInput): string | null {
  const label = String(row.parameter || '').trim();
  const value = String(row.value || '').trim();
  const combined = `${label} ${value} ${row.sourceText || ''}`.trim();

  if (!label) return 'empty_label';
  if (!value || value.length < 2) return 'empty_value';

  if (HEADING_ONLY_RX.test(label)) return 'heading_only';
  if (CLAUSE_NUMBER_LABEL_RX.test(label)) return 'clause_number';
  if (NUMBERED_CLAUSE_ONLY_RX.test(label)) return 'clause_number';
  if (/^\d+(?:\.\d+)+[\.\):]?\s*$/.test(label)) return 'clause_number';

  if (ANNEXURE_ONLY_LABEL_RX.test(label)) return 'annexure_reference';
  if (ANNEXURE_REF_RX.test(label) && value.length < 40 && !/\d/.test(value)) {
    return 'annexure_reference';
  }
  if (ANNEXURE_REF_RX.test(value) && value.split(/\s+/).length <= 6) return 'annexure_reference';

  if (TOC_ENTRY_RX.test(label) || TOC_ENTRY_RX.test(value)) return 'table_of_contents';
  if (/^index$/i.test(label) || /^contents$/i.test(label)) return 'table_of_contents';

  if (CONTACT_ONLY_LABEL_RX.test(label)) return 'contact_block';
  if (/^contact\s+(?:us|information|details)$/i.test(label)) return 'contact_block';
  if (EMAIL_PHONE_LABEL_RX.test(label)) return 'contact_block';
  if (EMAIL_VALUE_RX.test(value)) return 'email_block';
  if (PHONE_VALUE_RX.test(value) && value.replace(/\D/g, '').length >= 7) return 'phone_number';

  if (PAGE_NUMBER_LABEL_RX.test(label) || PAGE_NUMBER_LABEL_RX.test(value)) return 'page_number';
  if (HEADER_FOOTER_LABEL_RX.test(label)) return 'header_footer';
  if (DOCUMENT_METADATA_RX.test(label) || DOCUMENT_METADATA_RX.test(value)) return 'document_metadata';
  if (SECTION_CHAPTER_REF_RX.test(label)) return 'section_reference';
  if (CLAUSE_REF_ONLY_RX.test(label)) return 'clause_reference';
  if (REPEATED_TITLE_RX.test(label)) return 'repeated_title';

  if (CONTACT_BLOCK_RX.test(label) && !/\b(?:emd|tender|bid|eligibility|experience|turnover|license|licence|certificate|guarantee|deposit|period|requirement|count|staff|manpower|warranty|sla|deployment|authorization|psara|oem|maf|guard|vehicle|fuel|machinery|surveillance)\b/i.test(label)) {
    return 'contact_block';
  }

  if (NAVIGATION_ONLY_LABEL_RX.test(label)) return 'navigation_content';
  if (NAVIGATION_RX.test(combined) && value.split(/\s+/).length <= 12) return 'navigation_content';

  if (isRepeatedParameterText(value)) return 'repeated_text';
  if (label.toLowerCase() === value.toLowerCase()) return 'label_equals_value';

  return null;
}

export function filterDuplicateDynamicParameters<T extends BusinessRelevanceInput>(
  rows: T[]
): { unique: T[]; duplicates: T[] } {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicates: T[] = [];

  for (const row of rows) {
    const fp = buildParameterFingerprint(row);
    if (seen.has(fp)) {
      duplicates.push(row);
      continue;
    }
    seen.add(fp);
    unique.push(row);
  }

  return { unique, duplicates };
}

export function toBusinessRelevanceInput(row: TenderParameterCandidateRow): BusinessRelevanceInput {
  return {
    parameter: row.originalLabel || row.parameter,
    value: row.value,
    sourceText: row.sourceText,
    page: row.page,
  };
}

/** Labels that resemble genuine tender-specific requirements (not OCR noise). */
const ADDITIONAL_TENDER_PARAM_LABEL_RX =
  /\b(requirement|requirements|count|strength|period|duration|license|licence|certificate|authorization|authorisation|warranty|guarantee|sla|manpower|deployment|certification|specification|capacity|rating|grade|minimum|maximum|preference|registration|compliance|guard|staff|employee|vehicle|machinery|concrete|surveillance|housekeeping|amc|nos\.?|number\s+of|psara|oem|maf|epf|esic|turnover|experience|validity|deposit|security)\b/i;

export function resolveKnownAdditionalParameter(parameter: string) {
  const key = normalizeAliasKey(parameter);
  return DYNAMIC_PARAMETER_REGISTRY.find(
    (entry) =>
      normalizeAliasKey(entry.name) === key ||
      entry.aliases.some(
        (alias) => normalizeAliasKey(alias) === key || key.includes(normalizeAliasKey(alias))
      )
  );
}

export function isKnownAdditionalTenderParameter(parameter: string): boolean {
  return matchStaticDynamicRegistry(parameter) || !!resolveKnownAdditionalParameter(parameter);
}

export function looksLikeAdditionalTenderRequirement(parameter: string, value: string): boolean {
  const label = String(parameter || '').trim();
  const val = String(value || '').trim();
  if (label.length < 3 || label.length > 75) return false;
  if (!/[A-Za-z]{2,}/.test(label)) return false;
  if (!ADDITIONAL_TENDER_PARAM_LABEL_RX.test(label)) return false;
  if (!val || val.length < 2 || val.length > 280) return false;
  if (rejectBusinessIrrelevantDynamicParameter({ parameter: label, value: val })) return false;
  if (label.split(/\s+/).length > 10) return false;
  return true;
}

export function getBusinessRelevantDiscoveryRuleSummary(): {
  allowedCategories: readonly string[];
  rejectedNoiseTypes: string[];
} {
  return {
    allowedCategories: BUSINESS_RELEVANT_CATEGORIES,
    rejectedNoiseTypes: [
      'Table Of Contents',
      'Index Entries',
      'Page Numbers',
      'Header Text',
      'Footer Text',
      'Annexure References',
      'Clause References',
      'Chapter References',
      'Section References',
      'Navigation Text',
      'Contact Blocks',
      'Email Blocks',
      'Phone Numbers',
      'Repeated Titles',
      'Document Metadata',
      'Headings',
      'Repeated Text',
    ],
  };
}
