import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/apiResponse';
import { workflowService } from '../services/workflow/workflowService';
import { FinanceRequest } from '../models/FinanceRequest';
import { ComplianceRequest } from '../models/ComplianceRequest';
import { TenderDocument } from '../models/TenderDocument';
import { FinanceRequestType } from '../types';
import { paramId } from '../utils/params';
import { fileStorageService } from '../services/storage/fileStorageService';
import { s3Service } from '../services/s3/s3Service';
import { env } from '../config/env';
import { notificationService } from '../services/notification/notificationService';
import { NotificationType } from '../types';

export const mdApprove = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { approved, comments } = req.body;
  const result = await workflowService.mdDecision(
    paramId(req.params.tenderId),
    approved !== false,
    req.user!._id,
    req.user!.role,
    comments
  );
  sendSuccess(res, result, approved !== false ? 'Tender approved' : 'Tender rejected');
});

export const createFinanceRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { requestType, amount } = req.body;
  const request = await workflowService.createFinanceRequest(
    paramId(req.params.tenderId),
    req.user!._id,
    requestType as FinanceRequestType,
    amount
  );
  sendSuccess(res, request, 'Finance request created', 201);
});

export const financeDecision = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { approved, comments } = req.body;
  const result = await workflowService.financeDecision(
    paramId(req.params.requestId),
    approved !== false,
    req.user!._id,
    req.user!.role,
    comments
  );
  sendSuccess(res, result);
});

export const updateFinancePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { transactionId, utrNumber, bankDetails } = req.body;
  if (!utrNumber && !transactionId) {
    throw new AppError('UTR number or Transaction ID is required', 400);
  }

  const request = await FinanceRequest.findById(paramId(req.params.requestId)).populate('tenderId requestedBy');
  if (!request) throw new AppError('Finance request not found', 404);
  if (request.status !== 'FINANCE_APPROVED') {
    throw new AppError('Payment can only be recorded for approved requests', 400);
  }

  request.transactionId = transactionId || request.transactionId;
  request.utrNumber = utrNumber || request.utrNumber;
  request.bankDetails = bankDetails || request.bankDetails;
  request.paidAt = new Date();
  await request.save();

  await notificationService.notifyUser(
    request.requestedBy,
    NotificationType.FINANCE_REQUEST,
    'Payment Recorded',
    `Payment of Rs. ${request.amount} for ${request.requestType} has been recorded. UTR: ${request.utrNumber || request.transactionId}`,
    'FinanceRequest',
    String(request._id)
  );

  sendSuccess(res, request, 'Payment recorded successfully');
});

export const createComplianceRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { documentTypes } = req.body;
  const request = await workflowService.createComplianceRequest(
    paramId(req.params.tenderId),
    req.user!._id,
    documentTypes || []
  );
  sendSuccess(res, request, 'Compliance request created', 201);
});

export const uploadComplianceDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) throw new AppError('No file uploaded', 400);

  const request = await ComplianceRequest.findById(paramId(req.params.requestId));
  if (!request) throw new AppError('Compliance request not found', 404);

  const tenderId = String(request.tenderId);
  const { fileName, relativePath } = await fileStorageService.saveFile(
    file.buffer,
    file.originalname,
    `compliance/${tenderId}`
  );

  let s3Key = relativePath;
  let s3Url = fileStorageService.getPublicUrl(relativePath);
  if (env.aws.accessKeyId) {
    const s3Result = await s3Service.uploadFile(file.buffer, file.originalname, file.mimetype, `compliance/${tenderId}`);
    s3Key = s3Result.key;
    s3Url = s3Result.url;
  }

  const doc = await TenderDocument.create({
    tenderId: request.tenderId,
    fileName,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    s3Key,
    s3Url,
    localPath: relativePath,
    documentType: 'COMPLIANCE',
    uploadedBy: req.user!._id,
  });

  request.documentIds.push(doc._id);
  await request.save();

  await notificationService.notifyUser(
    request.requestedBy,
    NotificationType.COMPLIANCE_REQUEST,
    'Compliance Document Uploaded',
    `Manager uploaded "${file.originalname}" for your compliance request.`,
    'ComplianceRequest',
    String(request._id)
  );

  sendSuccess(res, { request, document: doc }, 'Compliance document uploaded', 201);
});

export const approveCompliance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await workflowService.approveCompliance(
    paramId(req.params.requestId),
    req.user!._id,
    req.user!.role
  );
  sendSuccess(res, result, 'Compliance approved');
});

export const getFinanceRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string;
  const tenderId = req.query.tenderId as string;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (tenderId) query.tenderId = tenderId;

  const role = req.user!.role;
  if (role === 'executive') query.requestedBy = req.user!._id;

  const requests = await FinanceRequest.find(query)
    .populate('tenderId requestedBy approvedBy rejectedBy')
    .sort({ createdAt: -1 });
  sendSuccess(res, requests);
});

export const getComplianceRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string;
  const tenderId = req.query.tenderId as string;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (tenderId) query.tenderId = tenderId;

  const role = req.user!.role;
  if (role === 'executive') query.requestedBy = req.user!._id;

  const requests = await ComplianceRequest.find(query)
    .populate('tenderId requestedBy approvedBy documentIds')
    .sort({ createdAt: -1 });
  sendSuccess(res, requests);
});
