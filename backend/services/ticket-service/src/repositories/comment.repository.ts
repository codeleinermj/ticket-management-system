import { prisma } from "../lib/prisma";

export class CommentRepository {
  async findByTicketId(ticketId: string) {
    return prisma.comment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async create(data: { content: string; ticketId: string; userId: string }) {
    return prisma.comment.create({
      data: {
        content: data.content,
        ticketId: data.ticketId,
        userId: data.userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.comment.delete({ where: { id } });
  }

  async findById(id: string) {
    return prisma.comment.findUnique({ where: { id } });
  }
}

export const commentRepository = new CommentRepository();
