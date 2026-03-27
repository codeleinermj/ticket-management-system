import { prisma } from "../lib/prisma";

export class TicketReadRepository {
  async markAsRead(userId: string, ticketId: string) {
    return prisma.ticketRead.upsert({
      where: { userId_ticketId: { userId, ticketId } },
      update: { lastReadAt: new Date() },
      create: { userId, ticketId },
    });
  }

  async getLastReadDates(userId: string, ticketIds: string[]) {
    const reads = await prisma.ticketRead.findMany({
      where: { userId, ticketId: { in: ticketIds } },
      select: { ticketId: true, lastReadAt: true },
    });
    return new Map(reads.map((r) => [r.ticketId, r.lastReadAt]));
  }

  async getLastCommentDates(ticketIds: string[], excludeUserId: string) {
    const comments = await prisma.comment.findMany({
      where: {
        ticketId: { in: ticketIds },
        userId: { not: excludeUserId },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["ticketId"],
      select: { ticketId: true, createdAt: true },
    });
    return new Map(comments.map((c) => [c.ticketId, c.createdAt]));
  }
}

export const ticketReadRepository = new TicketReadRepository();
