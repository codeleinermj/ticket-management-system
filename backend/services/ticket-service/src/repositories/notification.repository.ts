import { prisma } from "../lib/prisma";

export class NotificationRepository {
  async findByUserId(userId: string, params: { limit: number; unreadOnly: boolean }) {
    const where: any = { userId };
    if (params.unreadOnly) where.read = false;

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
    });
  }

  async countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  }

  async create(data: { type: string; title: string; message: string; ticketId?: string; userId: string }) {
    return prisma.notification.create({ data });
  }

  async createMany(notifications: { type: string; title: string; message: string; ticketId?: string; userId: string }[]) {
    return prisma.notification.createMany({ data: notifications });
  }

  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}

export const notificationRepository = new NotificationRepository();
