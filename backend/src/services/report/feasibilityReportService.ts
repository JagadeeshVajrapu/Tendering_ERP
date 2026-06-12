import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { fileStorageService } from '../storage/fileStorageService';
import { feasibilityReportRepository } from '../../repositories/tenderRepository';
import { tenderRepository } from '../../repositories/tenderRepository';
import { enterpriseFeasibilityReportService } from './enterpriseFeasibilityReportService';

class FeasibilityReportService {
  /**
   * Generate enterprise MD feasibility report from master dataset, checklist, and risk analysis.
   */
  async generateReport(tenderId: string, userId: Types.ObjectId) {
    return enterpriseFeasibilityReportService.generateAndStore(tenderId, userId);
  }

  async getLatestReport(tenderId: string) {
    const result = await enterpriseFeasibilityReportService.getLatest(tenderId);
    return {
      report: result.report,
      enterprise: result.enterprise,
      pdfUrl: result.pdfUrl,
      tender: result.tender,
    };
  }
}

export const feasibilityReportService = new FeasibilityReportService();
