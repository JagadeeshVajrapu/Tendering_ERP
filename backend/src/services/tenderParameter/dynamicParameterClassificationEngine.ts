import { DiscoveredParameterCategory } from '../../types/enterpriseDynamicParameterDiscovery';
import { classifyParameterGroup } from '../parameterDiscovery/parameterGroupingEngine';
import { ADDITIONAL_TENDER_PARAMETERS_CATEGORY } from '../nit/professionalNitAnalysisSections';
import { PROFESSIONAL_NIT_DISPLAY_CATEGORIES } from '../nit/professionalNitAnalysisSections';

const GROUP_TO_DISCOVERED: Record<string, DiscoveredParameterCategory> = {
  'General Information': 'Identity',
  'Financial Information': 'Financial',
  'Important Dates': 'Timeline',
  'Eligibility Criteria': 'Eligibility',
  'Compliance Requirements': 'Compliance',
  'Technical Requirements': 'Technical',
  'Contact Information': 'Identity',
};

const DISCOVERY_CATEGORY_PATTERNS: Array<{ category: DiscoveredParameterCategory; patterns: RegExp[] }> = [
  { category: 'Financial', patterns: [/fee|amount|cost|value|emd|turnover|guarantee|security|budget|deposit|pbg|ebg/i] },
  { category: 'Timeline', patterns: [/date|period|duration|deadline|validity|amc|warranty|dlp|completion|commencement/i] },
  { category: 'Eligibility', patterns: [/eligib|qualification|bid\s+capacity|net\s+worth|turnover\s+requirement/i] },
  { category: 'Compliance', patterns: [/gst|pan|msme|iso|certificate|license|licence|registration|psara|epf|esic|labour/i] },
  { category: 'Experience', patterns: [/experience|similar work|past work|completion certificate|work order/i] },
  { category: 'Technical', patterns: [/specification|technical|dimension|tolerance|grade|capacity|rating|model|make|material/i] },
  { category: 'Scope', patterns: [/scope|deployment|manpower|personnel|staff|service\s+level|surveillance|housekeeping/i] },
  { category: 'Tender Specific', patterns: [/requirement|count|nos|guard|gardener|concrete|cloud|data center|maf|oem|make in india|mse|ePBG/i] },
  { category: 'Identity', patterns: [/tender\s+no|nit|organization|department|name\s+of\s+work|location|authority/i] },
];

export function classifyDiscoveredParameter(parameter: string, value: string): DiscoveredParameterCategory {
  const group = classifyParameterGroup(parameter, value);
  if (group in GROUP_TO_DISCOVERED) {
    return GROUP_TO_DISCOVERED[group];
  }

  const combined = `${parameter} ${value}`;
  for (const rule of DISCOVERY_CATEGORY_PATTERNS) {
    if (rule.patterns.some((p) => p.test(combined))) return rule.category;
  }

  if ((PROFESSIONAL_NIT_DISPLAY_CATEGORIES as readonly string[]).includes(parameter)) {
    return parameter as DiscoveredParameterCategory;
  }

  return ADDITIONAL_TENDER_PARAMETERS_CATEGORY;
}
