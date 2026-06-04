import nodemailer from 'nodemailer';
import { Server as SocketServer } from 'socket.io';
import { Types } from 'mongoose';
import { Notification } from '../../models/Notification';
import { User } from '../../models/User';
import { env } from '../../config/env';
import { NotificationType, UserRole } from '../../types';

let io: SocketServer | null = null;

class NotificationService {
  setSocketServer(socketServer: SocketServer): void {
    io = socketServer;
  }

  private getTransporter() {
    if (!env.smtp.host || !env.smtp.user) return null;
    return nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: false,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }

  async notifyUser(
    userId: Types.ObjectId | string,
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: Types.ObjectId | string
  ): Promise<void> {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
    });

    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }

    const user = await User.findById(userId);
    if (user?.email) {
      await this.sendEmail(user.email, title, message);
      notification.emailSent = true;
      await notification.save();
    }
  }

  async notifyRole(
    role: UserRole,
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: Types.ObjectId | string
  ): Promise<void> {
    const users = await User.find({ role, isActive: true });
    await Promise.all(
      users.map((u) => this.notifyUser(u._id, type, title, message, entityType, entityId))
    );
  }

  async getUserNotifications(userId: string, unreadOnly = false) {
    const query: Record<string, unknown> = { userId };
    if (unreadOnly) query.isRead = false;
    return Notification.find(query).sort({ createdAt: -1 }).limit(50);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await Notification.findOneAndUpdate({ _id: notificationId, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) return;
    try {
      await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject: `[TenderNova] ${subject}`,
        html: `<div style="font-family:sans-serif"><h2>${subject}</h2><p>${body}</p></div>`,
      });
    } catch (err) {
      console.error('Email send failed:', err);
    }
  }
}

export const notificationService = new NotificationService();
