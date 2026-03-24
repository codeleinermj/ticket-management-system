import { prisma } from "../lib/prisma";

export class AttachmentRepository {
  async findByTicketId(ticketId: string) {
    return prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  async findById(id: string) {
    return prisma.attachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  async create(data: {
    filename: string;
    storagePath: string;
    mimeType: string;
    size: number;
    ticketId: string;
    uploadedById: string;
  }) {
    return prisma.attachment.create({
      data,
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
  }

  async delete(id: string) {
    return prisma.attachment.delete({ where: { id } });
  }

  async countByTicketId(ticketId: string) {
    return prisma.attachment.count({ where: { ticketId } });
  }

  async totalSizeByTicketId(ticketId: string) {
    const result = await prisma.attachment.aggregate({
      where: { ticketId },
      _sum: { size: true },
    });
    return result._sum.size || 0;
  }
}

export const attachmentRepository = new AttachmentRepository();
