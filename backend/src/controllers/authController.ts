import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { env } from '../config/env';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/apiResponse';
import { auditService } from '../services/audit/auditService';

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, email, password, role, department } = req.body;
  const exists = await User.findOne({ email });
  if (exists) throw new AppError('Email already registered', 400);

  const user = await User.create({ name, email, password, role, department });
  sendSuccess(res, { id: user._id, name: user.name, email: user.email, role: user.role }, 'User created', 201);
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }
  if (!user.isActive) throw new AppError('Account deactivated', 403);

  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign({ userId: user._id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);

  await auditService.log({
    userId: user._id,
    userRole: user.role,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user._id,
    ipAddress: req.socket.remoteAddress,
  });

  sendSuccess(res, {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department },
  });
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, {
    id: req.user!._id,
    name: req.user!.name,
    email: req.user!.email,
    role: req.user!.role,
    department: req.user!.department,
  });
});
