import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { nitAnalysisGeneratorService } from '../services/nit/nitAnalysisGeneratorService';
import {
  nitAnalysisExportService,
  NitAnalysisExportFormat,
} from '../services/nit/nitAnalysisExportService';

/** GET /api/tender/:id/nit-analysis — Enterprise master dataset → dynamic NIT sections. */
export const getTenderNitAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  const report = await nitAnalysisGeneratorService.generateForTender(new Types.ObjectId(tenderId), {
    refresh,
  });
  sendSuccess(res, report);
});

/** GET /api/tender/:id/nit-analysis/export?format=json|excel|pdf */
export const exportTenderNitAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const format = String(req.query.format || 'json').toLowerCase() as NitAnalysisExportFormat;

  if (!['json', 'excel', 'pdf'].includes(format)) {
    throw new AppError('Invalid format. Use json, excel, or pdf.', 400);
  }

  const report = await nitAnalysisGeneratorService.generateForTender(new Types.ObjectId(tenderId), {
    refresh: false,
  });

  const baseName = `NIT_Analysis_${tenderId}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.json"`);
    res.send(nitAnalysisExportService.toJson(report));
    return;
  }

  if (format === 'excel') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
    res.send(nitAnalysisExportService.toExcelCsv(report));
    return;
  }

  const pdf = await nitAnalysisExportService.toPdfBuffer(report);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
  res.send(pdf);
});
