import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { adminDashboardService } from '../services/admin/adminDashboardService';
import { UserRole } from '../types';

/** GET /api/admin/dashboard */
export const getAdminDashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const data = await adminDashboardService.getDashboard();
  sendSuccess(res, data);
});

/** GET /api/admin/users */
export const listAdminUsers = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const users = await adminDashboardService.listUsers();
  sendSuccess(res, users);
});

/** PATCH /api/admin/users/:id */
export const updateAdminUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = paramId(req.params.id);
  const { role, isActive, department } = req.body as {
    role?: UserRole;
    isActive?: boolean;
    department?: string;
  };

  if (role && !Object.values(UserRole).includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  if (String(req.user!._id) === userId && isActive === false) {
    throw new AppError('Cannot deactivate your own account', 400);
  }

  const user = await adminDashboardService.updateUser(userId, { role, isActive, department });
  sendSuccess(res, user, 'User updated');
});
