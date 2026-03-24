import { prisma } from "../lib/prisma";

export class PasswordResetRepository {
  async create(data: { tokenHash: string; userId: string; expiresAt: Date }) {
    return prisma.passwordReset.create({ data });
  }

  async findValidByTokenHash(tokenHash: string) {
    return prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async markAsUsed(id: string) {
    return prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async countRecentByUserId(userId: string, sinceMinutes: number) {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    return prisma.passwordReset.count({
      where: { userId, createdAt: { gte: since } },
    });
  }
}

export const passwordResetRepository = new PasswordResetRepository();
