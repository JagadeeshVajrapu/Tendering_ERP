import { Types } from 'mongoose';
import { Tender, ITender } from '../models/Tender';
import { TenderDocument, ITenderDocument } from '../models/TenderDocument';
import { TenderAnalysis, ITenderAnalysis } from '../models/TenderAnalysis';
import { FeasibilityReport, IFeasibilityReport } from '../models/FeasibilityReport';
import { TenderStatus } from '../types';

export class TenderRepository {
  async create(data: Partial<ITender>): Promise<ITender> {
    return Tender.create(data);
  }

  async findById(id: string): Promise<ITender | null> {
    return Tender.findById(id);
  }

  async updateFromAnalysis(
    tenderId: string,
    analysis: { tenderName?: string; tenderNumber?: string; organization?: string; estimatedValue?: string }
  ): Promise<ITender | null> {
    const updates: Partial<ITender> = {};
    if (analysis.tenderName) updates.title = analysis.tenderName;
    if (analysis.tenderNumber) updates.tenderNumber = analysis.tenderNumber;
    if (analysis.organization) updates.authority = analysis.organization;
    const numericValue = parseFloat(String(analysis.estimatedValue).replace(/[^\d.]/g, ''));
    if (!Number.isNaN(numericValue) && numericValue > 0) updates.estimatedValue = numericValue;

    return Tender.findByIdAndUpdate(tenderId, updates, { new: true });
  }

  async setStatus(tenderId: string, status: TenderStatus, stage: string): Promise<ITender | null> {
    return Tender.findByIdAndUpdate(tenderId, { status, currentStage: stage }, { new: true });
  }
}

export class TenderDocumentRepository {
  async create(data: Partial<ITenderDocument>): Promise<ITenderDocument> {
    return TenderDocument.create(data);
  }

  async findById(id: string): Promise<ITenderDocument | null> {
    return TenderDocument.findById(id);
  }

  async findLatestByTender(tenderId: string): Promise<ITenderDocument | null> {
    return TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
  }
}

export class TenderAnalysisRepository {
  async create(data: Partial<ITenderAnalysis>): Promise<ITenderAnalysis> {
    return TenderAnalysis.create(data);
  }

  async findLatestByTender(tenderId: string): Promise<ITenderAnalysis | null> {
    return TenderAnalysis.findOne({ tenderId })
      .sort({ createdAt: -1 })
      .populate('analyzedBy', 'name email role')
      .populate('documentId', 'originalName fileName mimeType fileSize localPath');
  }

  async findById(id: string): Promise<ITenderAnalysis | null> {
    return TenderAnalysis.findById(id);
  }
}

export class FeasibilityReportRepository {
  async create(data: Partial<IFeasibilityReport>): Promise<IFeasibilityReport> {
    return FeasibilityReport.create(data);
  }

  async findLatestByTender(tenderId: string): Promise<IFeasibilityReport | null> {
    return FeasibilityReport.findOne({ tenderId }).sort({ createdAt: -1 });
  }
}

export const tenderRepository = new TenderRepository();
export const tenderDocumentRepository = new TenderDocumentRepository();
export const tenderAnalysisRepository = new TenderAnalysisRepository();
export const feasibilityReportRepository = new FeasibilityReportRepository();

export type { Types };
