import { Types } from 'mongoose';
import { PageText } from '../../types/intelligence';
import { CandidateDetectionResult } from '../../types/candidateDetection';
import { DocumentFieldCandidate } from '../../models/DocumentFieldCandidate';
import { candidateDetectionEngine } from './candidateDetectionEngine';

export interface CandidateStoreContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
}

class CandidateDetectionService {
  detect(pages: PageText[]): CandidateDetectionResult {
    return candidateDetectionEngine.detect(pages);
  }

  async detectAndStore(pages: PageText[], ctx: CandidateStoreContext): Promise<CandidateDetectionResult> {
    const result = candidateDetectionEngine.detect(pages);
    await this.saveCandidates(ctx, result);
    return result;
  }

  async saveCandidates(ctx: CandidateStoreContext, result: CandidateDetectionResult): Promise<void> {
    await DocumentFieldCandidate.deleteMany({ documentId: ctx.documentId });

    if (!result.candidates.length) return;

    await DocumentFieldCandidate.insertMany(
      result.candidates.map((c) => ({
        documentId: ctx.documentId,
        tenderId: ctx.tenderId,
        jobId: ctx.jobId,
        fieldName: c.fieldName,
        candidateValue: c.candidateValue,
        sourcePage: c.sourcePage,
        sourceText: c.sourceText,
        detectionMethod: c.detectionMethod,
        confidence: c.confidence,
      }))
    );
  }

  async getStoredCandidates(documentId: Types.ObjectId) {
    return DocumentFieldCandidate.find({ documentId }).sort({ fieldName: 1, sourcePage: 1 });
  }
}

export const candidateDetectionService = new CandidateDetectionService();
