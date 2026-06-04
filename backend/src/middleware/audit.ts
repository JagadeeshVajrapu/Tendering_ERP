import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { auditService } from '../services/audit/auditService';

export function auditAction(action: string, entityType: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (req.user && res.statusCode < 400) {
        const bodyObj = typeof body === 'object' && body !== null ? (body as { data?: { _id?: string } }) : undefined;
        const entityId = req.params.id || req.params.tenderId || bodyObj?.data?._id;
        auditService.log({
          userId: req.user._id,
          userRole: req.user.role,
          action,
          entityType,
          entityId: entityId as string | undefined,
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
          newValue: typeof body === 'object' ? (body as Record<string, unknown>) : undefined,
          metadata: { method: req.method, path: req.path },
        }).catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
}
