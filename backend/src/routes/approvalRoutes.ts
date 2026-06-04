import { Router } from 'express';
import {
  mdApprove,
  createFinanceRequest,
  financeDecision,
  updateFinancePayment,
  createComplianceRequest,
  approveCompliance,
  uploadComplianceDocument,
  getFinanceRequests,
  getComplianceRequests,
} from '../controllers/approvalController';
import { authenticate, authorize, authorizeRoles } from '../middleware/auth';
import { UserRole } from '../types';
import { tenderDocumentUpload } from '../middleware/upload';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { paramId } from '../utils/params';
import { FinanceRequest } from '../models/FinanceRequest';
import { fileStorageService } from '../services/storage/fileStorageService';
import { s3Service } from '../services/s3/s3Service';
import { env } from '../config/env';

const router = Router();

router.use(authenticate);

router.post('/md/:tenderId', authorizeRoles(UserRole.MD), authorize('approval:md'), mdApprove);
router.post('/finance/:tenderId', authorize('finance:request'), createFinanceRequest);
router.get('/finance', authorize('finance:read', 'tender:read'), getFinanceRequests);
router.patch('/finance/:requestId/decision', authorizeRoles(UserRole.FINANCE), authorize('finance:approve'), financeDecision);
router.patch('/finance/:requestId/payment', authorizeRoles(UserRole.FINANCE), authorize('finance:update_payment'), updateFinancePayment);

router.post(
  '/finance/:requestId/proof',
  authorizeRoles(UserRole.FINANCE),
  authorize('finance:upload_proof'),
  tenderDocumentUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError('No file uploaded', 400);

    const { fileName, relativePath } = await fileStorageService.saveFile(file.buffer, file.originalname, 'payments');
    let url = fileStorageService.getPublicUrl(relativePath);
    let key = relativePath;
    if (env.aws.accessKeyId) {
      const s3Result = await s3Service.uploadFile(file.buffer, file.originalname, file.mimetype, 'payments');
      key = s3Result.key;
      url = s3Result.url;
    }

    const request = await FinanceRequest.findByIdAndUpdate(
      paramId(req.params.requestId),
      { paymentProofKey: key, paymentProofUrl: url },
      { new: true }
    );
    sendSuccess(res, request, 'Payment proof uploaded');
  })
);

router.post('/compliance/:tenderId', authorize('compliance:request'), createComplianceRequest);
router.get('/compliance', authorize('compliance:read', 'tender:read'), getComplianceRequests);
router.post(
  '/compliance/:requestId/documents',
  authorizeRoles(UserRole.MANAGER),
  authorize('compliance:upload'),
  tenderDocumentUpload.single('file'),
  uploadComplianceDocument
);
router.post('/compliance/:requestId/approve', authorizeRoles(UserRole.MANAGER), authorize('compliance:approve'), approveCompliance);

export default router;
