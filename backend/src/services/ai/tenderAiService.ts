import { env } from '../../config/env';

import { ITenderAnalysisData } from '../../models/TenderAnalysis';

import { FeasibilityReportContent } from '../report/pdfService';

import { finalizeTenderAnalysis } from '../analysis/analysisNormalizer';

import { getOpenAIClient, isOpenAIApiError, getOpenAIErrorMessage } from './openaiClient';

import { buildLocalTenderAnalysis, buildLocalFeasibilityContent } from './localAnalysisService';



const TENDER_ANALYSIS_PROMPT = `You are an expert analyst for Indian government and private sector tender/NIT documents (CPWD, GeM, PSU, state e-procurement).



Read the ENTIRE document carefully. Extract every field below from any section (cover page, NIT, eligibility, financial bid, technical bid, annexures, corrigendum).



RULES:

- Search using synonyms: "Tender Authority" = organization, department, inviting authority, purchaser, buyer.

- "Tender Value" = estimated cost, contract value, approximate value, cost of work (include currency: ₹ or Rs.).

- "EMD" = earnest money, bid security, tender fee deposit.

- "BG" = bank guarantee, performance guarantee, PBG, security deposit.

- "Completion Time" = contract period, time for completion, delivery period, within X days/months.

- "Eligibility" = turnover, OEM, experience, similar work, registration, MSME, class of contractor — list each DISTINCT criterion as a separate short item (max 12 words each).

- "Technical Requirements" = ISO, MSME, GST, BIS, certifications, specifications — list each DISTINCT requirement separately, no duplicates.

- "Submission Date" = last date for bid submission, due date, closing date.

- "Reverse Auction" = Yes or No only.

- "MAF" = Manufacturer Authorization Form — Yes or No only.

- "Scope of Work" = one concise line (e.g. "Supply + Installation").

- DEDUPLICATE: never repeat the same item in a list. Merge similar items into one.

- If a field is truly absent, use "" for strings and [] for arrays. Do NOT invent data.



Return ONLY valid JSON:

{

  "tenderName": "string",

  "department": "string",

  "organization": "string",

  "tenderNumber": "string",

  "estimatedValue": "string with currency e.g. ₹2.5 Cr",

  "emdAmount": "string with currency e.g. ₹5 Lakh",

  "bgRequirement": "Yes/No or amount/details",

  "bidSubmissionDate": "string date",

  "preBidMeetingDate": "string date",

  "contractDuration": "string e.g. 180 Days",

  "scopeOfWork": "concise summary",

  "eligibilityCriteria": ["Turnover", "OEM", "Experience"],

  "technicalRequirements": ["ISO", "MSME", "GST"],

  "reverseAuction": "Yes or No",

  "mafRequired": "Yes or No",

  "requiredDocuments": ["string"],

  "importantDates": [{"label": "string", "date": "string"}],

  "paymentTerms": "string",

  "riskFactors": ["string"],

  "aiRecommendation": "Suitable or Not Suitable with brief reason"

}`;



const FEASIBILITY_REPORT_PROMPT = `You are a management consultant preparing a one-page tender feasibility report for senior leadership.

Based on the tender analysis data provided, return ONLY valid JSON:

{

  "scopeSummary": "2-3 sentence scope summary",

  "eligibilitySummary": "2-3 sentence eligibility summary",

  "timelineSummary": "2-3 sentence timeline summary including key dates",

  "financialSummary": "2-3 sentence financial summary covering value, EMD, payment terms",

  "keyRisks": ["top 3-5 risks as short bullet strings"],

  "recommendation": "Suitable" or "Not Suitable"

}

Keep each summary concise and professional. Total content must fit one page.`;



class TenderAiService {

  private async chat(system: string, userContent: string): Promise<string> {

    const client = getOpenAIClient();

    if (!client) {

      throw new Error('OpenAI client not available');

    }



    const response = await client.chat.completions.create({

      model: env.openai.model,

      messages: [

        { role: 'system', content: system },

        { role: 'user', content: userContent.slice(0, 120000) },

      ],

      temperature: 0.1,

      response_format: { type: 'json_object' },

    });

    return response.choices[0]?.message?.content || '{}';

  }



  private parseJson<T>(text: string): T {

    try {

      return JSON.parse(text) as T;

    } catch {

      const match = text.match(/\{[\s\S]*\}/);

      if (match) return JSON.parse(match[0]) as T;

      throw new Error('Failed to parse AI response');

    }

  }



  private coerceAnalysis(data: Partial<ITenderAnalysisData>): ITenderAnalysisData {

    return {

      tenderName: String(data.tenderName ?? ''),

      department: String(data.department ?? ''),

      organization: String(data.organization ?? ''),

      tenderNumber: String(data.tenderNumber ?? ''),

      estimatedValue: String(data.estimatedValue ?? ''),

      emdAmount: String(data.emdAmount ?? ''),

      bgRequirement: String(data.bgRequirement ?? ''),

      bidSubmissionDate: String(data.bidSubmissionDate ?? ''),

      preBidMeetingDate: String(data.preBidMeetingDate ?? ''),

      contractDuration: String(data.contractDuration ?? ''),

      scopeOfWork: String(data.scopeOfWork ?? ''),

      eligibilityCriteria: Array.isArray(data.eligibilityCriteria) ? data.eligibilityCriteria.map(String) : [],

      technicalRequirements: Array.isArray(data.technicalRequirements) ? data.technicalRequirements.map(String) : [],

      reverseAuction: String(data.reverseAuction ?? ''),

      mafRequired: String(data.mafRequired ?? ''),

      requiredDocuments: Array.isArray(data.requiredDocuments) ? data.requiredDocuments.map(String) : [],

      importantDates: Array.isArray(data.importantDates) ? data.importantDates : [],

      paymentTerms: String(data.paymentTerms ?? ''),

      riskFactors: Array.isArray(data.riskFactors) ? data.riskFactors.map(String) : [],

      aiRecommendation: String(data.aiRecommendation ?? ''),

    };

  }



  private logFallback(reason: string): void {

    console.warn(`[TenderAI] Using local analysis supplement (${reason}).`);

  }



  async analyzeTenderDocument(rawText: string): Promise<ITenderAnalysisData> {

    const localExtraction = buildLocalTenderAnalysis(rawText);

    let aiExtraction: ITenderAnalysisData | null = null;



    if (getOpenAIClient()) {

      try {

        const result = await this.chat(TENDER_ANALYSIS_PROMPT, rawText);

        aiExtraction = this.coerceAnalysis(this.parseJson<Partial<ITenderAnalysisData>>(result));

      } catch (err) {

        if (env.openai.fallbackOnError && isOpenAIApiError(err)) {

          this.logFallback(getOpenAIErrorMessage(err));

        } else {

          throw err;

        }

      }

    } else {

      this.logFallback('OpenAI disabled or no API key');

    }



    const primary = aiExtraction ?? localExtraction;

    return finalizeTenderAnalysis(primary, localExtraction);

  }



  async generateFeasibilityContent(analysis: ITenderAnalysisData): Promise<FeasibilityReportContent> {

    if (!getOpenAIClient()) {

      return buildLocalFeasibilityContent(analysis);

    }



    try {

      const result = await this.chat(FEASIBILITY_REPORT_PROMPT, JSON.stringify(analysis, null, 2));

      const parsed = this.parseJson<FeasibilityReportContent>(result);

      parsed.recommendation = parsed.recommendation === 'Not Suitable' ? 'Not Suitable' : 'Suitable';

      return parsed;

    } catch (err) {

      if (env.openai.fallbackOnError && isOpenAIApiError(err)) {

        this.logFallback(getOpenAIErrorMessage(err));

        return buildLocalFeasibilityContent(analysis);

      }

      throw err;

    }

  }

}



export const tenderAiService = new TenderAiService();

