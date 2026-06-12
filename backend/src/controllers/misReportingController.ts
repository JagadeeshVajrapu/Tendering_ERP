import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { misReportingService } from '../services/misReporting/misReportingService';
import { listMisExportDescriptors } from '../services/misReporting/misExportRegistry';
import { MisFilterQuery } from '../types/misReporting';
import { TenderStatus } from '../types';
import { PostAwardContractStatus } from '../types/postAward';

function parseFilters(req: AuthRequest): MisFilterQuery {
  return {
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined,
    serviceCategory: req.query.serviceCategory ? String(req.query.serviceCategory) : undefined,
    clientName: req.query.clientName ? String(req.query.clientName) : undefined,
    tenderStatus: req.query.tenderStatus
      ? (String(req.query.tenderStatus) as TenderStatus)
      : undefined,
    contractStatus: req.query.contractStatus
      ? (String(req.query.contractStatus) as PostAwardContractStatus)
      : undefined,
  };
}

/** GET /api/mis/dashboard */
export const getMisDashboard = asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = parseFilters(req);
  const data = await misReportingService.getDashboard(filters, req.user!.role);
  sendSuccess(res, data);
});

/** GET /api/mis/tender-performance */
export const getMisTenderPerformance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getTenderPerformance(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/tender-value */
export const getMisTenderValue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getTenderValue(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/service-category */
export const getMisServiceCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getServiceCategory(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/finance-summary */
export const getMisFinanceSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getFinanceSummary(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/contracts */
export const getMisContracts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getContracts(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/revenue */
export const getMisRevenue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getRevenue(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/alerts */
export const getMisAlerts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = await misReportingService.getAlerts(parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/search?q= */
export const getMisSearch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query.q ? String(req.query.q) : '';
  const data = await misReportingService.search(q, parseFilters(req));
  sendSuccess(res, data);
});

/** GET /api/mis/recent-activity */
export const getMisRecentActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
  const data = await misReportingService.getRecentActivity(parseFilters(req), limit);
  sendSuccess(res, data);
});

/** GET /api/mis/export-registry — export-ready architecture (no export execution) */
export const getMisExportRegistry = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, { exports: listMisExportDescriptors() });
});
