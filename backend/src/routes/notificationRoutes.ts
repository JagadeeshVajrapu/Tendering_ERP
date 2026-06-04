import { Router } from 'express';
import { getNotifications, markRead, markAllRead, getAuditLogs } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getNotifications);
router.patch('/:id/read', markRead);
router.patch('/read-all', markAllRead);
router.get('/audit-logs', getAuditLogs);

export default router;
