import { Response } from 'express';
import { Tender, TenderDocument, TenderSummary, Approval, FinanceRequest, ComplianceRequest } from '../models';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { TenderStatus, UserRole } from '../types';
import { s3Service } from '../services/s3/s3Service';
import { ocrService } from '../services/ocr/ocrService';
import { nitAnalysisService } from '../services/nit/nitAnalysisService';
import { openaiService } from '../services/ai/openaiService';
import { workflowService } from '../services/workflow/workflowService';
import { EligibilityResult } from '../models/EligibilityResult';
import { paramId } from '../utils/params';

export const createTender = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, tenderNumber, authority, estimatedValue } = req.body;
  const tender = await Tender.create({
    title: title || 'New Tender',
    tenderNumber,
    authority,
    estimatedValue,
    createdBy: req.user!._id,
    assignedExecutive: req.user!._id,
    status: TenderStatus.DRAFT,
  });
  sendSuccess(res, tender, 'Tender created', 201);
});

export const getTenders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const query: Record<string, unknown> = {};

  if (req.user!.role === UserRole.EXECUTIVE) {
    query.createdBy = req.user!._id;
  }
  if (status) query.status = status;

  const [tenders, total] = await Promise.all([
    Tender.find(query)
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Tender.countDocuments(query),
  ]);
  sendPaginated(res, tenders, total, page, limit);
});

export const getTenderById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tender = await Tender.findById(paramId(req.params.id))
    .populate('createdBy', 'name email role')
    .populate('assignedExecutive', 'name email');
  if (!tender) throw new AppError('Tender not found', 404);
  sendSuccess(res, tender);
});

export const uploadDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('No file uploaded', 400);

  const tenderId = paramId(req.params.id);
  const tender = await Tender.findById(tenderId);
  if (!tender) throw new AppError('Tender not found', 404);

  const { key, url } = await s3Service.uploadFile(file.buffer, file.originalname, file.mimetype, 'nit');
  const extractedText = await ocrService.extractText(file.buffer, file.mimetype, file.originalname);

  const doc = await TenderDocument.create({
    tenderId: tender._id,
    fileName: key.split('/').pop() || file.originalname,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    s3Key: key,
    s3Url: url,
    documentType: (req.body.documentType as 'NIT') || 'NIT',
    uploadedBy: req.user!._id,
    extractedText,
  });

  sendSuccess(res, doc, 'Document uploaded', 201);
});

export const analyzeNit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentId } = req.body;
  const result = await nitAnalysisService.analyzeDocument(
    paramId(req.params.id),
    documentId,
    req.user!._id,
    req.user!.role
  );
  sendSuccess(res, result, 'NIT analysis completed');
});

export const getNitAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await nitAnalysisService.getAnalysis(paramId(req.params.id));
  sendSuccess(res, result);
});

export const generateSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const { nitAnalysis, eligibility } = await nitAnalysisService.getAnalysis(tenderId);
  const summaryData = await openaiService.generateSummary(
    nitAnalysis.extractedData,
    eligibility?.summary || 'Not evaluated'
  );

  const summary = await TenderSummary.create({
    tenderId,
    nitAnalysisId: nitAnalysis._id,
    ...summaryData,
    generatedBy: req.user!._id,
    aiGenerated: true,
  });

  await workflowService.updateTenderStatus(
    paramId(req.params.id),
    TenderStatus.SUMMARY_GENERATED,
    req.user!._id,
    req.user!.role
  );

  sendSuccess(res, summary, 'Summary generated');
});

export const getSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const summary = await TenderSummary.findOne({ tenderId }).sort({ createdAt: -1 });
  if (!summary) throw new AppError('Summary not found', 404);
  const eligibility = await EligibilityResult.findOne({ tenderId }).sort({ createdAt: -1 });
  sendSuccess(res, { summary, eligibility });
});

export const submitToMd = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const summary = await TenderSummary.findOne({ tenderId }).sort({ createdAt: -1 });
  const { FeasibilityReport } = await import('../models/FeasibilityReport');
  const report = await FeasibilityReport.findOne({ tenderId }).sort({ createdAt: -1 });

  if (!summary && !report) throw new AppError('Generate feasibility report first', 400);

  const referenceId = summary ? String(summary._id) : String(report!._id);
  const tender = await workflowService.submitToMd(
    paramId(req.params.id),
    req.user!._id,
    req.user!.role,
    referenceId
  );
  sendSuccess(res, tender, 'Submitted to MD for approval');
});

export const getDashboardStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = req.user!.role;
  const baseQuery: Record<string, unknown> = role === UserRole.EXECUTIVE ? { createdBy: req.user!._id } : {};

  const statuses = Object.values(TenderStatus);
  const counts = await Promise.all(
    statuses.map((s) => Tender.countDocuments({ ...baseQuery, status: s }))
  );
  const statusCounts = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));

  const recent = await Tender.find(baseQuery).sort({ updatedAt: -1 }).limit(5);

  sendSuccess(res, {
    totalTenders: await Tender.countDocuments(baseQuery),
    statusCounts,
    pendingApproval: statusCounts[TenderStatus.PENDING_MD_APPROVAL] || 0,
    approved: statusCounts[TenderStatus.APPROVED_BY_MD] || 0,
    rejected: statusCounts[TenderStatus.REJECTED_BY_MD] || 0,
    financePending: statusCounts[TenderStatus.FINANCE_PENDING] || 0,
    readyForBid: statusCounts[TenderStatus.READY_FOR_BID] || 0,
    recentActivities: recent,
  });
});

export const getMdDashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const { FeasibilityReport } = await import('../models/FeasibilityReport');

  const [pending, approved, rejected, history] = await Promise.all([
    Approval.find({ type: 'MD', decision: 'PENDING' })
      .populate({ path: 'tenderId', populate: { path: 'createdBy', select: 'name email department' } })
      .populate({ path: 'requestedBy', select: 'name email department' })
      .sort({ createdAt: -1 }),
    Tender.countDocuments({ status: TenderStatus.APPROVED_BY_MD }),
    Tender.countDocuments({ status: TenderStatus.REJECTED_BY_MD }),
    Approval.find({ type: 'MD', decision: { $ne: 'PENDING' } })
      .populate({ path: 'tenderId', populate: { path: 'createdBy', select: 'name email' } })
      .populate({ path: 'requestedBy', select: 'name email department' })
      .populate({ path: 'reviewedBy', select: 'name email' })
      .sort({ decidedAt: -1 })
      .limit(50),
  ]);

  const pendingWithReports = await Promise.all(
    pending.map(async (approval) => {
      const tenderId = approval.tenderId && typeof approval.tenderId === 'object'
        ? (approval.tenderId as { _id: unknown })._id
        : approval.tenderId;
      const report = tenderId
        ? await FeasibilityReport.findOne({ tenderId }).sort({ createdAt: -1 })
        : null;
      return { ...(approval.toObject()), feasibilityReport: report };
    })
  );

  const historyWithReports = await Promise.all(
    history.map(async (approval) => {
      const tenderId = approval.tenderId && typeof approval.tenderId === 'object'
        ? (approval.tenderId as { _id: unknown })._id
        : approval.tenderId;
      const report = tenderId
        ? await FeasibilityReport.findOne({ tenderId }).sort({ createdAt: -1 })
        : null;
      return { ...(approval.toObject()), feasibilityReport: report };
    })
  );

  sendSuccess(res, {
    pending: pendingWithReports,
    approved,
    rejected,
    history: historyWithReports,
    totalSubmitted: await Approval.countDocuments({ type: 'MD' }),
  });
});

export const getFinanceDashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [pending, approved, rejected, paidHistory] = await Promise.all([
    FinanceRequest.find({ status: 'FINANCE_PENDING' })
      .populate('tenderId requestedBy')
      .sort({ createdAt: -1 }),
    FinanceRequest.find({ status: 'FINANCE_APPROVED' })
      .populate('tenderId requestedBy approvedBy')
      .sort({ updatedAt: -1 })
      .limit(50),
    FinanceRequest.find({ status: 'FINANCE_REJECTED' })
      .populate('tenderId requestedBy rejectedBy')
      .sort({ updatedAt: -1 })
      .limit(30),
    FinanceRequest.find({ utrNumber: { $exists: true, $ne: '' } })
      .populate('tenderId requestedBy approvedBy')
      .sort({ paidAt: -1 })
      .limit(50),
  ]);

  sendSuccess(res, {
    pending,
    approved,
    rejected,
    paidHistory,
    stats: {
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      paidCount: paidHistory.length,
      totalAmountPending: pending.reduce((s, r) => s + r.amount, 0),
      totalAmountPaid: paidHistory.reduce((s, r) => s + r.amount, 0),
    },
  });
});

export const getManagerDashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [pending, completed, history] = await Promise.all([
    ComplianceRequest.find({ status: 'MANAGER_PENDING' })
      .populate('tenderId requestedBy')
      .sort({ createdAt: -1 }),
    ComplianceRequest.find({ status: 'MANAGER_APPROVED' })
      .populate({ path: 'tenderId' })
      .populate({ path: 'requestedBy', select: 'name email department' })
      .populate({ path: 'approvedBy', select: 'name email' })
      .populate({ path: 'documentIds' })
      .sort({ decidedAt: -1 })
      .limit(50),
    ComplianceRequest.find()
      .populate('tenderId requestedBy approvedBy documentIds')
      .sort({ createdAt: -1 })
      .limit(100),
  ]);

  sendSuccess(res, { pending, completed, history });
});

export const getTenderWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tenderId = paramId(req.params.id);
  const [financeRequests, complianceRequests, mdApprovals] = await Promise.all([
    FinanceRequest.find({ tenderId })
      .populate('requestedBy approvedBy rejectedBy')
      .sort({ createdAt: -1 }),
    ComplianceRequest.find({ tenderId })
      .populate('requestedBy approvedBy')
      .populate('documentIds')
      .sort({ createdAt: -1 }),
    Approval.find({ tenderId, type: 'MD' })
      .populate('requestedBy reviewedBy')
      .sort({ createdAt: -1 }),
  ]);

  sendSuccess(res, { financeRequests, complianceRequests, mdApprovals });
});
