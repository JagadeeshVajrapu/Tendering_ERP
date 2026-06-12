import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getPostAwardDashboard,
  searchPostAwardContracts,
  syncPostAwardAlerts,
  checkPostAwardAvailability,
} from '../controllers/postAwardController';

const router = Router();

router.use(authenticate);

const postAwardRead = authorize('postaward:read', 'tender:read');
const postAwardAdmin = authorize('postaward:admin');

router.get('/dashboard', postAwardRead, getPostAwardDashboard);
router.get('/contracts/search', postAwardRead, searchPostAwardContracts);
router.get('/availability/:tenderId', postAwardRead, checkPostAwardAvailability);
router.post('/alerts/sync', postAwardAdmin, syncPostAwardAlerts);

export default router;
