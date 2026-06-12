import { TenderParameterExtractionMetadata } from '../../types/tenderParameterCandidateExtraction';

const DISCOVERY_EXAMPLES = [
  'Tender Number',
  'NIT Number',
  'Organization',
  'Department',
  'Name of Work',
  'Tender Value',
  'Estimated Cost',
  'EMD Amount',
  'Performance Guarantee',
  'Tender Fee',
  'Completion Period',
  'Bid End Date',
  'Eligibility Criteria',
  'Turnover Requirement',
  'Experience Requirement',
  'GST Requirement',
  'Scope of Work',
].join(', ');

export function buildCandidateExtractionSystemPrompt(): string {
  return `You are a Senior Government Tender Analyst extracting structured tender parameters from OCR text.

EXTRACT ONLY explicit label → value pairs from:
- Notice Inviting Tender (NIT)
- Tender schedules and important dates tables
- Eligibility / qualification criteria
- Financial conditions (EMD, tender fee, performance guarantee, tender value)
- Compliance requirement lines (GST, PAN, MSME, ISO, PF, ESIC)
- Scope summaries with concrete counts, amounts, or periods

DO NOT EXTRACT:
- Contract clause sentences ("The contractor shall…", "Bidder must…")
- Terms and conditions paragraphs
- Technical specification prose or equipment descriptions
- Numbered legal clauses (3.1, 12.4, etc.) unless they contain a clear field label and atomic value
- Table-of-contents, annexure headers, declaration forms, integrity pact
- Sentence fragments used as parameter names

PARAMETER RULES:
1. Parameter name: max 10 words, must read like a field label (not a sentence).
2. Value: atomic — amount, date, count, period, percentage, organization name, yes/no, or short phrase (max ~120 chars).
3. Never use an entire paragraph as a value.
4. Use ONLY OCR text. Never invent, guess, or summarize.
5. Preserve exact amounts, dates, tender numbers, and organization names.
6. sourceText must be the exact OCR snippet containing label and value.
7. page must match the [PAGE N] marker where the value appears.
8. Omit parameters not found in OCR.

CONFIDENCE (required, integer 55–100):
- 95–100: exact label + exact value in OCR (NIT / schedule)
- 85–94: clear alias match + exact value
- 70–84: valid field with supporting OCR context
- Below 70: do not include

Examples of GOOD extractions:
  parameter: "EMD Amount", value: "Rs.33,59,315", confidence: 98
  parameter: "Name of Work", value: "Providing Manpower Services at CSIR-CRRI Delhi", confidence: 95
  parameter: "Completion Period", value: "24 Months", confidence: 92

Examples of BAD extractions (never output):
  parameter: "The contractor shall maintain", value: "<full clause paragraph>"
  parameter: "Technical specifications", value: "<multi-paragraph spec text>"

Known parameter examples: ${DISCOVERY_EXAMPLES}
Also include other genuine tender fields that follow the same label→value pattern.

Output JSON only:
{
  "parameters": [
    {
      "parameter": "EMD Amount",
      "value": "Rs.33,59,315",
      "page": 3,
      "confidence": 98,
      "sourceText": "Earnest Money Deposit (EMD): Rs.33,59,315"
    }
  ]
}`;
}

function buildMetadataBlock(metadata?: TenderParameterExtractionMetadata): string {
  if (!metadata) return '';
  const lines: string[] = [];
  if (metadata.documentName) lines.push(`Document: ${metadata.documentName}`);
  if (metadata.tenderTitle) lines.push(`Tender Title: ${metadata.tenderTitle}`);
  return lines.length ? `${lines.join('\n')}\n\n` : '';
}

export function buildCandidateExtractionUserPrompt(
  startPage: number,
  endPage: number,
  ocrPayload: string,
  opts?: {
    aliasHints?: string;
    serviceContext?: string;
    metadata?: TenderParameterExtractionMetadata;
  }
): string {
  const metadataBlock = buildMetadataBlock(opts?.metadata);
  const typeContext = opts?.serviceContext?.trim()
    ? `\n${opts.serviceContext}\n`
    : '';
  const aliasHints = opts?.aliasHints?.trim() ? `\n${opts.aliasHints}\n` : '';

  return `${metadataBlock}Extract structured tender parameters from pages ${startPage} to ${endPage}.
Each page is tagged with [SECTIONS: ...]. Extract parameters ONLY from matching business sections:
- Identity params from Identity pages
- Financial params (EMD, Tender Value, Fees) from Financial pages
- Dates from Timeline pages
- Compliance (GST, PAN, EPF) from Compliance pages
- Scope from Scope pages
Do NOT extract core parameters from Annexures unless explicitly a tender-specific form field.
Do NOT extract contract clauses or specification paragraphs.
${typeContext}${aliasHints}
${ocrPayload}`;
}
