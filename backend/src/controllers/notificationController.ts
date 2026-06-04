import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/apiResponse';
import { notificationService } from '../services/notification/notificationService';
import { auditService } from '../services/audit/auditService';
import { paramId } from '../utils/params';

export const getNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const unreadOnly = req.query.unread === 'true';
  const notifications = await notificationService.getUserNotifications(String(req.user!._id), unreadOnly);
  sendSuccess(res, notifications);
});

export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationService.markAsRead(paramId(req.params.id), String(req.user!._id));
  sendSuccess(res, null, 'Marked as read');
});

export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationService.markAllAsRead(String(req.user!._id));
  sendSuccess(res, null, 'All marked as read');
});

export const getAuditLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await auditService.getLogs({
    userId: req.query.userId as string,
    entityType: req.query.entityType as string,
    entityId: req.query.entityId as string,
    page,
    limit,
  });
  sendSuccess(res, result);
});
