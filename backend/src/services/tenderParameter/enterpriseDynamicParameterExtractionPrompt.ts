import { MASTER_TENDER_PARAMETER_DICTIONARY } from './masterTenderParameterDictionary';
import { NIT_PARAMETER_GROUP_ORDER } from './masterTenderParameterDictionary';
import { TENDER_PARAMETER_ALIAS_CATALOG } from './tenderParameterAliasCatalog';
import { formatDocumentedAliasExamplesForPrompt } from './parameterAliasMappings';

const DYNAMIC_PARAMETER_EXAMPLES = [
  'OEM Authorization',
  'MAF Requirement',
  'PSARA License',
  'Drone Surveillance Requirement',
  'Vehicle Requirement',
  'Warranty Period',
  'Security Guard Count',
  'Housekeeping Staff Count',
  'Make and Model',
  'Delivery Period',
  'Response Time SLA',
  'Concrete Grade',
].join(', ');

const OUTPUT_CATEGORIES = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Technical Specifications',
  'Annexures',
  'Tender Specific',
].join(', ');

function buildKnownParameterList(): string {
  return NIT_PARAMETER_GROUP_ORDER.map((group) => {
    const items = MASTER_TENDER_PARAMETER_DICTIONARY.filter((d) => d.group === group);
    const lines = items.map((item) => {
      const aliasDef = TENDER_PARAMETER_ALIAS_CATALOG.find((a) => a.canonicalKey === item.canonicalKey);
      const ocrExamples = aliasDef
        ? [aliasDef.canonical, ...aliasDef.aliases.slice(0, 4)].join(' | ')
        : item.canonical;
      return `  - ${item.canonical} (OCR: ${ocrExamples})`;
    });
    return `${group}:\n${lines.join('\n')}`;
  }).join('\n\n');
}

export function buildEnterpriseDynamicExtractionSystemPrompt(): string {
  const knownParameters = buildKnownParameterList();

  return `You are an Enterprise Government Tender Parameter Extraction Engine.

INPUT (provided per request):
- OCR Text (only source of truth)
- Tender Type (domain context)
- Section Name (document section being analyzed)

GOAL:
Extract ALL genuine tender parameters from the OCR text.

EXTRACT:
1. Known Parameters (from master dictionary — use canonical names when OCR clearly matches)
2. Unknown Tender Parameters (any new field with a clear label and value in OCR)
3. Tender-Specific Requirements (conditions, thresholds, counts, certifications)

STRICT RULES:
1. Use ONLY OCR text. Never invent values. Never guess. Never summarize.
2. Preserve exact values character-for-character:
   - Amounts (Rs., INR, lakhs, crores)
   - Dates and times
   - Percentages
   - Counts and manpower numbers
   - Tender numbers and reference IDs
   - Organization names and locations
3. sourceText must be the exact OCR snippet containing the label and value.
4. page must match the [PAGE N] marker where the value appears.
5. If a parameter is not present in OCR, omit it entirely.
6. Do NOT restrict extraction to fixed fields — extract any new genuine parameter you find.

REJECT (never output as parameters):
- Page headers: "Page 33 of 48", page numbers, footers
- Enclosure/complaint forms, registers, blank templates, integrity pact boilerplate
- Entire contract clauses or paragraphs as values (values must be short: amounts, dates, names, counts)
- Table-of-contents lines, OCR garbage, sentence fragments used as parameter names
- Any parameter name longer than 8 words unless it is a standard tender field label

GOOD examples:
  parameter: "EMD Amount", value: "Rs. 33,59,315", page: 5
  parameter: "Name of Work", value: "Maintenance of ESIC Office Hyderabad", page: 2
  parameter: "Bid Submission Date", value: "15-03-2025 17:00", page: 3

BAD examples (do NOT output):
  parameter: "Page 35 of 48 ENCLOSURE", value: "<entire form paragraph>"
  parameter: "The contractor shall", value: "<contract clause text>"

KNOWN PARAMETERS (prefer these names when OCR matches):
${knownParameters}

ALIAS EXAMPLES:
${formatDocumentedAliasExamplesForPrompt()}

UNKNOWN / DYNAMIC PARAMETER EXAMPLES (also extract any similar genuine fields):
${DYNAMIC_PARAMETER_EXAMPLES}

OUTPUT CATEGORIES: ${OUTPUT_CATEGORIES}
Use the provided Section Name as category when it fits; otherwise pick the best category.

Return JSON only:
{
  "parameters": [
    {
      "parameter": "",
      "value": "",
      "page": "",
      "sourceText": "",
      "confidence": "",
      "category": ""
    }
  ]
}`;
}

export function buildEnterpriseDynamicExtractionUserPrompt(input: {
  tenderType: string;
  sectionName: string;
  startPage: number;
  endPage: number;
  ocrPayload: string;
  aliasHints?: string;
  extraContext?: string;
}): string {
  const aliasHints = input.aliasHints?.trim() ? `\nALIAS HINTS:\n${input.aliasHints}\n` : '';
  const extraContext = input.extraContext?.trim() ? `\n${input.extraContext}\n` : '';

  return `ENTERPRISE DYNAMIC PARAMETER EXTRACTION

Tender Type: ${input.tenderType || 'Unclassified'}
Section Name: ${input.sectionName}
Pages: ${input.startPage}-${input.endPage}

Extract ALL genuine tender parameters from this section OCR.
Include known parameters AND unknown tender-specific parameters.
Never invent values. Never guess. Use ONLY OCR text below.
${aliasHints}${extraContext}
${input.ocrPayload}`;
}
