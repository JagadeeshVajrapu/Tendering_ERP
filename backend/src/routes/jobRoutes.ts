import { Router } from 'express';
import { getJobStatus } from '../controllers/jobController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:jobId', getJobStatus);

export default router;
