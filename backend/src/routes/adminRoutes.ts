import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getAdminDashboard, listAdminUsers, updateAdminUser } from '../controllers/adminController';

const router = Router();

router.use(authenticate);

const adminRead = authorize('admin:read', 'admin:manage');
const adminManage = authorize('admin:manage', 'admin:users');

router.get('/dashboard', adminRead, getAdminDashboard);
router.get('/users', adminManage, listAdminUsers);
router.patch('/users/:id', adminManage, updateAdminUser);

export default router;
