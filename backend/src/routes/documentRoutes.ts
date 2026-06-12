import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getDocumentEnterpriseMasterDataset } from '../controllers/enterpriseMasterDatasetController';

const router = Router();

router.use(authenticate);

/** Enterprise master dataset — single source of truth for tender intelligence */
router.get('/:id/master-dataset', authorize('tender:read'), getDocumentEnterpriseMasterDataset);

export default router;
