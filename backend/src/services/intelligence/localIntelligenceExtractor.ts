import {
  ChunkExtractionResult,
  ExtractedField,
  ExtractionPass,
  IntelligenceFieldKey,
  MergedIntelligence,
  PageText,
} from '../../types/intelligence';
import { ALL_INTELLIGENCE_FIELDS, PASS_FIELDS } from './fields';
import { mergeEngine } from './mergeEngine';

const LOCAL_CONFIDENCE = 0.82;

function sanitizeStatutory(text: string, fallback: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length >= 3 && t.length <= 120) return t;
  return fallback;
}

function extractPattern(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ');
  }
  return '';
}

function extractAmount(text: string, labels: string[]): string {
  for (const label of labels) {
    const patterns = [
      new RegExp(
        `${label}[^\\d₹]{0,50}((?:Rs\\.?|INR|₹)?\\s*[\\d,]+(?:\\.\\d+)?\\s*(?:/-)?(?:\\s*(?:Cr|Crore|Lakh|Lac|lakhs))?)[^.\\n]{0,20}`,
        'i'
      ),
      new RegExp(`${label}\\s*[:\\-]\\s*((?:Rs\\.?|INR|₹)?\\s*[\\d,]+(?:\\.\\d+)?)`, 'i'),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]) return m[1].trim();
    }
  }
  return '';
}

function extractDate(text: string, labels: string[]): string {
  for (const label of labels) {
    const m = text.match(
      new RegExp(`${label}[^:\\n]{0,40}[:\\s]+(\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}(?:\\s+\\d{1,2}:\\d{2})?)`, 'i')
    );
    if (m?.[1]) return m[1].trim();
    const m2 = text.match(
      new RegExp(`${label}[^:\\n]{0,40}[:\\s]+(\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{2,4})`, 'i')
    );
    if (m2?.[1]) return m2[1].trim();
  }
  return '';
}

function extractListFromSection(text: string, keywords: string[], maxItems = 20): string[] {
  const items: string[] = [];
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    const slice = text.slice(idx, idx + 2000);
    const lines = slice
      .split(/\n|(?:\d+\.)|(?:\([a-zivx]+\))|(?:•)|(?:\-\s)/)
      .map((l) => l.trim().replace(/\s+/g, ' '))
      .filter((l) => l.length >= 5 && l.length <= 350 && !/^page\s+\d/i.test(l));
    for (const line of lines) {
      if (!items.includes(line) && items.length < maxItems) items.push(line);
    }
  }
  return items;
}

function field(
  value: string | string[] | null,
  page: number,
  confidence = LOCAL_CONFIDENCE
): ExtractedField[] {
  if (!value || (Array.isArray(value) && !value.length)) return [];
  return [{ value, page, confidence }];
}

function findPageForPattern(pages: PageText[], pattern: RegExp): number {
  for (const p of pages) {
    if (pattern.test(p.text)) return p.pageNumber;
  }
  return pages[0]?.pageNumber || 1;
}

function findPageForLabel(pages: PageText[], labels: string[]): number {
  for (const p of pages) {
    const lower = p.text.toLowerCase();
    if (labels.some((l) => lower.includes(l.toLowerCase()))) return p.pageNumber;
  }
  return pages[0]?.pageNumber || 1;
}

/** Extract all intelligence fields from full document using regex — no API required. */
class LocalIntelligenceExtractor {
  extractFromPages(pages: PageText[]): ChunkExtractionResult[] {
    if (!pages.length) return [];

    const fullText = pages.map((p) => p.text).join('\n');
    const fields = this.extractAllFields(pages, fullText);

    const result: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};
    for (const [key, extractions] of Object.entries(fields)) {
      if (extractions?.length) result[key as IntelligenceFieldKey] = extractions;
    }

    return [
      {
        chunkNumber: 0,
        pass: 'general' as ExtractionPass,
        fields: result,
        rawJson: JSON.stringify(result),
        model: 'local-regex',
      },
    ];
  }

  extractMerged(pages: PageText[]): MergedIntelligence {
    return mergeEngine.merge(this.extractFromPages(pages));
  }

  /** Extract fields for a single chunk (used as AI fallback). */
  extractFromChunkText(
    chunkText: string,
    startPage: number,
    endPage: number,
    chunkNumber: number
  ): ChunkExtractionResult {
    const slicePages: PageText[] = [];
    const pageBlocks = chunkText.split(/--- PAGE (\d+) ---/);
    for (let i = 1; i < pageBlocks.length; i += 2) {
      slicePages.push({
        pageNumber: parseInt(pageBlocks[i], 10),
        text: pageBlocks[i + 1]?.trim() || '',
        method: 'native',
        charCount: pageBlocks[i + 1]?.length || 0,
      });
    }
    if (!slicePages.length) {
      slicePages.push({ pageNumber: startPage, text: chunkText, method: 'native', charCount: chunkText.length });
    }

    const fields = this.extractAllFields(slicePages, chunkText);
    const result: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};
    for (const [key, extractions] of Object.entries(fields)) {
      if (extractions?.length) result[key as IntelligenceFieldKey] = extractions;
    }

    return {
      chunkNumber,
      pass: 'general',
      fields: result,
      rawJson: JSON.stringify(result),
      model: 'local-regex',
    };
  }

  private extractAllFields(
    pages: PageText[],
    fullText: string
  ): Partial<Record<IntelligenceFieldKey, ExtractedField[]>> {
    const t = fullText.slice(0, 120000);
    const out: Partial<Record<IntelligenceFieldKey, ExtractedField[]>> = {};

    const set = (key: IntelligenceFieldKey, value: string | string[] | null, page: number) => {
      const extractions = field(value, page);
      if (extractions.length) out[key] = [...(out[key] || []), ...extractions];
    };

    const tenderName = extractPattern(t, [
      /(?:name of (?:work|tender)|title of (?:work|tender)|tender for|tender title)[:\s]+([^\n]{5,200})/i,
      /(?:invitation for|supply of|work of|procurement of)[:\s]+([^\n]{5,200})/i,
    ]);
    if (tenderName) set('tenderName', tenderName.slice(0, 300), findPageForLabel(pages, ['name of work', 'tender for']));

    const tenderNumber = extractPattern(t, [
      /tender\s*(?:no|number|id|ref)[.:\s]*([A-Z0-9/\-_.]+)/i,
      /nit\s*(?:no|number)[.:\s]*([A-Z0-9/\-_.]+)/i,
      /e-?tender\s*(?:no|id)[.:\s]*([A-Z0-9/\-_.]+)/i,
    ]);
    if (tenderNumber) set('tenderNumber', tenderNumber, findPageForLabel(pages, ['tender no', 'nit no']));

    const refNum = extractPattern(t, [/ref(?:erence)?\s*(?:no|number)?[.:\s]*([A-Z0-9/\-_.]+)/i]);
    if (refNum) set('tenderReferenceNumber', refNum, findPageForLabel(pages, ['reference']));

    const org = extractPattern(t, [
      /(?:tender(?:ing)? authority|issuing authority|name of organisation|organization)[:\s]+([^\n]{3,120})/i,
      /(?:organization|organisation|department|invited by)[:\s]+([^\n]{3,120})/i,
    ]);
    if (org) {
      set('organization', org, findPageForLabel(pages, ['authority', 'organization']));
      set('issuingAuthority', org, findPageForLabel(pages, ['authority']));
    }

    const dept = extractPattern(t, [/department[:\s]+([^\n]{3,100})/i]);
    if (dept) set('department', dept, findPageForLabel(pages, ['department']));

    const emd = extractAmount(t, ['emd amount', 'emd', 'earnest money deposit', 'earnest money', 'bid security']);
    if (emd) set('emdAmount', emd, findPageForLabel(pages, ['emd', 'earnest money']));

    const value = extractAmount(t, [
      'estimated contract value',
      'estimated value',
      'tender value',
      'contract value',
      'approximate value',
      'cost of work',
    ]);
    if (value) set('estimatedTenderValue', value, findPageForLabel(pages, ['tender value', 'estimated value']));

    const tenderFee = extractAmount(t, ['tender fee', 'tender document fee', 'cost of tender document']);
    if (tenderFee) set('tenderFee', tenderFee, findPageForLabel(pages, ['tender fee']));

    const bg = extractAmount(t, ['performance bank guarantee', 'performance guarantee', 'bank guarantee', 'PBG']);
    if (bg) set('bankGuarantee', bg, findPageForLabel(pages, ['bank guarantee']));

    const ps = extractAmount(t, ['performance security', 'security deposit']);
    if (ps) set('performanceSecurity', ps, findPageForLabel(pages, ['performance security']));

    const scope = extractPattern(t, [
      /(?:scope of work|nature of work|description of work|work to be done)[:\s]+([^\n]{15,400})/i,
    ]);
    if (scope) set('scopeOfWork', scope.slice(0, 500), findPageForLabel(pages, ['scope of work']));

    const duration = extractPattern(t, [
      /(?:completion time|contract period|contract duration|period of completion)[^:\n]*[:\s]+([^\n]{4,80})/i,
      /(?:within|in)\s+(\d+\s*(?:days|months|weeks))/i,
    ]);
    if (duration) set('contractDuration', duration, findPageForLabel(pages, ['completion', 'contract period']));

    const location = extractPattern(t, [
      /(?:work location|site of work|place of work|location)[:\s]+([^\n]{3,150})/i,
    ]);
    if (location) set('workLocation', location, findPageForLabel(pages, ['location', 'site of work']));

    const dates: [IntelligenceFieldKey, string[], string[]][] = [
      ['tenderPublishDate', ['publish date', 'date of publication', 'nit date'], ['publish', 'publication']],
      ['preBidMeetingDate', ['pre-bid meeting', 'pre bid meeting'], ['pre-bid', 'pre bid']],
      ['bidSubmissionStartDate', ['bid submission start', 'start date for submission'], ['submission start']],
      ['bidSubmissionDate', ['bid submission', 'last date', 'submission date', 'due date'], ['submission', 'last date']],
      ['bidOpeningDate', ['bid opening', 'opening date'], ['bid opening']],
      ['technicalBidOpeningDate', ['technical bid opening'], ['technical bid opening']],
      ['financialBidOpeningDate', ['financial bid opening'], ['financial bid opening']],
    ];

    for (const [key, labels, pageLabels] of dates) {
      const d = extractDate(t, labels);
      if (d) set(key, d, findPageForLabel(pages, pageLabels));
    }

    const listSections: [IntelligenceFieldKey, string[]][] = [
      ['eligibilityCriteria', ['eligibility', 'qualification criteria', 'pre-qualification']],
      ['experienceRequirements', ['experience requirement', 'similar work', 'past experience']],
      ['turnoverRequirements', ['turnover', 'annual turnover', 'average turnover']],
      ['technicalRequirements', ['technical requirement', 'technical specification', 'technical bid']],
      ['technicalConditions', ['technical condition', 'special condition']],
      ['requiredDocuments', ['required documents', 'documents to be submitted', 'bid documents', 'enclosures']],
      ['financialConditions', ['financial condition', 'payment condition']],
      ['financialRequirements', ['financial requirement', 'financial criteria']],
      ['complianceRequirements', ['compliance requirement', 'statutory compliance']],
      ['statutoryRequirements', ['statutory requirement', 'legal requirement']],
      ['registrationsRequired', ['registration required', 'valid registration']],
      ['certificationsRequired', ['certification required', 'iso', 'certificate required']],
      ['penaltyClauses', ['penalty clause', 'liquidated damages', 'penalty for']],
      ['risks', ['risk factor', 'disqualification', 'termination', 'forfeiture']],
    ];

    for (const [key, keywords] of listSections) {
      const items = extractListFromSection(t, keywords);
      if (items.length) {
        set(key, items, findPageForLabel(pages, keywords));
      }
    }

    const payment = extractPattern(t, [
      /payment terms[^:\n]*[:\s]+([^\n]{10,200})/i,
      /(?:mode of payment|payment schedule)[^:\n]*[:\s]+([^\n]{10,200})/i,
    ]);
    if (payment) set('paymentTerms', payment, findPageForLabel(pages, ['payment']));

    const contact = extractPattern(t, [
      /(?:contact person|contact details|for queries)[:\s]+([^\n]{5,150})/i,
    ]);
    if (contact) set('contactDetails', contact, findPageForLabel(pages, ['contact']));

    const submission = extractPattern(t, [
      /(?:mode of submission|submission mode|bid submission mode)[:\s]+([^\n]{5,100})/i,
      /((?:online|e-?tender|nic|gem)[^\n]{0,60}(?:portal|submission)?)/i,
    ]);
    if (submission) {
      set('submissionMode', submission.slice(0, 100), findPageForLabel(pages, ['submission', 'e-tender', 'portal']));
    }

    const statutoryScalars: [string, string[]][] = [
      ['gst registration', ['gst', 'gstin']],
      ['epf registration', ['epf']],
      ['esi registration', ['esi']],
      ['labour license', ['labour license', 'labor license']],
      ['pan card', ['pan']],
      ['msme', ['msme', 'udyam']],
      ['iso 9001', ['iso']],
    ];

    const statutoryItems: string[] = [];
    for (const [label, hints] of statutoryScalars) {
      const found = extractPattern(t, [
        new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n]{0,40}[:\\s]+([^\\n]{3,120})`, 'i'),
        new RegExp(`(valid\\s+${hints[0]}[^\\n]{3,80})`, 'i'),
      ]);
      if (found) statutoryItems.push(sanitizeStatutory(found, label));
      else if (t.toLowerCase().includes(label)) statutoryItems.push(label);
    }
    if (statutoryItems.length) {
      set('statutoryRequirements', statutoryItems, findPageForLabel(pages, ['statutory', 'registration', 'gst']));
    }

    void ALL_INTELLIGENCE_FIELDS;
    void PASS_FIELDS;
    return out;
  }
}

export const localIntelligenceExtractor = new LocalIntelligenceExtractor();
