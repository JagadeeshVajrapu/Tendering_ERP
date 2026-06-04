import { Types } from 'mongoose';
import { Tender, TenderDocument, NitAnalysis, EligibilityResult } from '../../models';
import { TenderStatus } from '../../types';
import { ocrService } from '../ocr/ocrService';
import { openaiService } from '../ai/openaiService';
import { eligibilityEngine } from '../rules/eligibilityEngine';
import { workflowService } from '../workflow/workflowService';
import { AppError } from '../../middleware/errorHandler';

class NitAnalysisService {
  async analyzeDocument(
    tenderId: string,
    documentId: string,
    userId: Types.ObjectId,
    userRole: import('../../types').UserRole
  ) {
    const start = Date.now();
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    let rawText = document.extractedText;
    if (!rawText) {
      throw new AppError('Document text not extracted. Re-upload document.', 400);
    }

    const extractedData = await openaiService.extractNitData(rawText);
    const riskAssessment = await openaiService.analyzeRisk(rawText, extractedData);
    const eligibility = eligibilityEngine.evaluate(extractedData);

    const nitAnalysis = await NitAnalysis.create({
      tenderId,
      documentId,
      extractedData,
      rawText: rawText.slice(0, 50000),
      riskAssessment,
      eligibilityScore: eligibility.score,
      analyzedBy: userId,
      aiModel: process.env.OPENAI_MODEL || 'mock',
      processingTimeMs: Date.now() - start,
    });

    await EligibilityResult.create({
      tenderId,
      nitAnalysisId: nitAnalysis._id,
      status: eligibility.status,
      score: eligibility.score,
      ruleChecks: eligibility.ruleChecks,
      summary: eligibility.summary,
      recommendations: eligibility.recommendations,
    });

    if (extractedData.tenderNumber) tender.tenderNumber = extractedData.tenderNumber;
    if (extractedData.tenderAuthority) tender.authority = extractedData.tenderAuthority;
    if (extractedData.tenderValue) tender.estimatedValue = extractedData.tenderValue;
    if (extractedData.tenderNumber) tender.title = extractedData.tenderNumber;
    await tender.save();

    await workflowService.updateTenderStatus(tenderId, TenderStatus.NIT_ANALYZED, userId, userRole);

    return { nitAnalysis, eligibility };
  }

  async getAnalysis(tenderId: string) {
    const nitAnalysis = await NitAnalysis.findOne({ tenderId })
      .sort({ createdAt: -1 })
      .populate('documentId')
      .populate('analyzedBy', 'name email');
    if (!nitAnalysis) throw new AppError('NIT analysis not found', 404);

    const eligibility = await EligibilityResult.findOne({ nitAnalysisId: nitAnalysis._id });
    return { nitAnalysis, eligibility };
  }
}

export const nitAnalysisService = new NitAnalysisService();
