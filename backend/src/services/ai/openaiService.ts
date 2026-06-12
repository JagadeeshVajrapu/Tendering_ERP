import { env } from '../../config/env';
import { IExtractedNitData, IRiskAssessment } from '../../models/NitAnalysis';
import { RiskLevel } from '../../types';
import { getOpenAIClient, isOpenAIApiError, getOpenAIErrorMessage } from './openaiClient';
import { isQuotaBlocked, markQuotaExceeded } from './aiQuotaGuard';
import {
  buildLocalNitExtraction,
  buildLocalRiskAssessment,
} from './localAnalysisService';

const EXTRACTION_PROMPT = `You are an expert tender/NIT document analyst. Extract structured data from the tender document text below.
Return ONLY valid JSON with this exact structure (use null for missing fields):
{
  "tenderAuthority": "string",
  "tenderNumber": "string",
  "tenderValue": number,
  "emdAmount": number,
  "bgRequirement": "string",
  "completionTime": "string",
  "eligibilityCriteria": ["string"],
  "technicalRequirements": ["string"],
  "submissionDate": "ISO date string",
  "bidOpeningDate": "ISO date string",
  "reverseAuction": boolean,
  "mafRequirement": "string",
  "scopeOfWork": "string",
  "preBidMeeting": "string",
  "experienceRequirement": "string",
  "turnoverRequirement": "string",
  "oemRequirement": "string",
  "msmeRequirement": "string",
  "gstRequirement": "string",
  "panRequirement": "string",
  "isoRequirement": "string",
  "importantDates": [{"label": "string", "date": "string"}],
  "requiredDocuments": ["string"]
}`;

const RISK_PROMPT = `Analyze this tender for risks. Return ONLY valid JSON:
{
  "riskSummary": "2-3 sentence summary",
  "disqualificationPoints": ["string"],
  "missingDocuments": ["string"],
  "criticalClauses": ["string"],
  "deadlineRisks": ["string"],
  "financialRisks": ["string"],
  "riskLevel": "High" | "Medium" | "Low"
}`;

const SUMMARY_PROMPT = `Generate executive tender summary. Return ONLY valid JSON:
{
  "tenderName": "string",
  "tenderAuthority": "string",
  "scope": "string",
  "eligibility": "string",
  "estimatedRevenue": number,
  "emdRequirement": "string",
  "completionTimeline": "string",
  "riskSummary": "string",
  "recommendation": "Proceed" | "Do Not Proceed",
  "recommendationReason": "string"
}`;

class OpenAIService {
  private async chat(system: string, userContent: string): Promise<string> {
    const client = getOpenAIClient();
    if (!client) throw new Error('OpenAI client not available');
    if (isQuotaBlocked('openai')) throw new Error('OpenAI API quota exceeded');

    try {
      const response = await client.chat.completions.create({
        model: env.openai.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent.slice(0, 120000) },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content || '{}';
    } catch (err) {
      if (isOpenAIApiError(err)) markQuotaExceeded('openai');
      throw err;
    }
  }

  /**
   * Generic helper for modules that need a strict JSON object response.
   * The caller is responsible for prompt/schema correctness.
   */
  async rawJsonObject(
    userPrompt: string,
    systemPrompt = 'Return ONLY a valid JSON object.',
    temperature = 0.2
  ): Promise<string> {
    const client = getOpenAIClient();
    if (!client) throw new Error('OpenAI client not available');
    if (isQuotaBlocked('openai')) throw new Error('OpenAI API quota exceeded');

    try {
      const response = await client.chat.completions.create({
        model: env.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt.slice(0, 120000) },
        ],
        temperature,
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content || '{}';
    } catch (err) {
      if (isOpenAIApiError(err)) markQuotaExceeded('openai');
      throw err;
    }
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

  private logFallback(reason: string): void {
    console.warn(`[OpenAI] Using local analysis (${reason}).`);
  }

  async extractNitData(rawText: string): Promise<IExtractedNitData> {
    if (!getOpenAIClient()) {
      return buildLocalNitExtraction(rawText);
    }

    try {
      const result = await this.chat(EXTRACTION_PROMPT, rawText);
      return this.parseJson<IExtractedNitData>(result);
    } catch (err) {
      if (env.openai.fallbackOnError && isOpenAIApiError(err)) {
        this.logFallback(getOpenAIErrorMessage(err));
        return buildLocalNitExtraction(rawText);
      }
      throw err;
    }
  }

  async analyzeRisk(rawText: string, extracted: IExtractedNitData): Promise<IRiskAssessment> {
    if (!getOpenAIClient()) {
      return buildLocalRiskAssessment();
    }

    try {
      const content = `Extracted Data:\n${JSON.stringify(extracted)}\n\nDocument:\n${rawText.slice(0, 50000)}`;
      const result = await this.chat(RISK_PROMPT, content);
      const parsed = this.parseJson<IRiskAssessment>(result);
      parsed.riskLevel = (parsed.riskLevel as RiskLevel) || RiskLevel.MEDIUM;
      return parsed;
    } catch (err) {
      if (env.openai.fallbackOnError && isOpenAIApiError(err)) {
        this.logFallback(getOpenAIErrorMessage(err));
        return buildLocalRiskAssessment();
      }
      throw err;
    }
  }

  async generateSummary(extracted: IExtractedNitData, eligibilitySummary: string): Promise<{
    tenderName: string;
    tenderAuthority: string;
    scope: string;
    eligibility: string;
    estimatedRevenue: number;
    emdRequirement: string;
    completionTimeline: string;
    riskSummary: string;
    recommendation: 'Proceed' | 'Do Not Proceed';
    recommendationReason: string;
  }> {
    const mock = () => ({
      tenderName: extracted.tenderNumber || 'Tender Opportunity',
      tenderAuthority: extracted.tenderAuthority || 'N/A',
      scope: extracted.scopeOfWork || 'N/A',
      eligibility: eligibilitySummary,
      estimatedRevenue: extracted.tenderValue || 0,
      emdRequirement: `EMD: Rs. ${extracted.emdAmount || 0}`,
      completionTimeline: extracted.completionTime || 'N/A',
      riskSummary: 'Standard tender risks apply.',
      recommendation: 'Proceed' as const,
      recommendationReason: 'Based on document review.',
    });

    if (!getOpenAIClient()) {
      return mock();
    }

    try {
      const content = `NIT Data:\n${JSON.stringify(extracted)}\nEligibility:\n${eligibilitySummary}`;
      const result = await this.chat(SUMMARY_PROMPT, content);
      return this.parseJson(result);
    } catch (err) {
      if (env.openai.fallbackOnError && isOpenAIApiError(err)) {
        this.logFallback(getOpenAIErrorMessage(err));
        return mock();
      }
      throw err;
    }
  }
}

export const openaiService = new OpenAIService();
