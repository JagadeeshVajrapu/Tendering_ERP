import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { tenderAiService } from '../ai/tenderAiService';
import {
  tenderRepository,
  tenderDocumentRepository,
  tenderAnalysisRepository,
  feasibilityReportRepository,
} from '../../repositories/tenderRepository';
import { TenderStatus } from '../../types';

class TenderAnalysisService {
  async analyzeDocument(
    tenderId: string,
    documentId: string,
    userId: Types.ObjectId
  ) {
    const document = await tenderDocumentRepository.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);
    if (String(document.tenderId) !== tenderId) throw new AppError('Document does not belong to this tender', 400);
    if (!document.extractedText) throw new AppError('No extracted text available. Re-upload the document.', 400);

    const start = Date.now();
    const analysisData = await tenderAiService.analyzeTenderDocument(document.extractedText);

    const analysis = await tenderAnalysisRepository.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: document._id,
      analyzedBy: userId,
      ...analysisData,
      rawText: document.extractedText.slice(0, 50000),
      aiModel: env.openai.apiKey ? env.openai.model : 'mock',
      processingTimeMs: Date.now() - start,
    });

    await tenderRepository.updateFromAnalysis(tenderId, analysisData);
    await tenderRepository.setStatus(tenderId, TenderStatus.NIT_ANALYZED, 'AI Analysis Complete');

    return analysis;
  }

  async analyzeFromUpload(
    tenderId: string,
    documentId: string,
    userId: Types.ObjectId,
    extractedText: string
  ) {
    const start = Date.now();
    const analysisData = await tenderAiService.analyzeTenderDocument(extractedText);

    const analysis = await tenderAnalysisRepository.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: new Types.ObjectId(documentId),
      analyzedBy: userId,
      ...analysisData,
      rawText: extractedText.slice(0, 50000),
      aiModel: env.openai.apiKey ? env.openai.model : 'mock',
      processingTimeMs: Date.now() - start,
    });

    await tenderRepository.updateFromAnalysis(tenderId, analysisData);
    await tenderRepository.setStatus(tenderId, TenderStatus.NIT_ANALYZED, 'AI Analysis Complete');

    return analysis;
  }

  async getAnalysis(tenderId: string) {
    const analysis = await tenderAnalysisRepository.findLatestByTender(tenderId);
    if (!analysis) throw new AppError('Tender analysis not found. Upload and analyze a document first.', 404);

    const tender = await tenderRepository.findById(tenderId);
    const report = await feasibilityReportRepository.findLatestByTender(tenderId);

    return { analysis, tender, report };
  }

  async reanalyze(tenderId: string, userId: Types.ObjectId) {
    const document = await tenderDocumentRepository.findLatestByTender(tenderId);
    if (!document) throw new AppError('No document found for this tender. Upload a document first.', 404);
    if (!document.extractedText) {
      throw new AppError('Document text not available. Re-upload the document.', 400);
    }

    return this.analyzeFromUpload(tenderId, String(document._id), userId, document.extractedText);
  }
}

export const tenderAnalysisService = new TenderAnalysisService();
