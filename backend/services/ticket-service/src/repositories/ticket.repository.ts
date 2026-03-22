import { prisma } from "../lib/prisma";
import type { Prisma } from "@repo/database";

export class TicketRepository {
  async findAll(params: {
    page: number;
    limit: number;
    userId?: string;
    role?: string;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
  }) {
    const { page, limit, userId, role, status, priority, category, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    // Regular users only see their own tickets
    if (role === "USER") {
      where.createdById = userId;
    }

    // Filters
    if (status) where.status = status as any;
    if (priority) where.priority = priority as any;
    if (category) where.category = category as any;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    // Match frontend PaginatedResponse<Ticket> shape: { data, meta }
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
        aiResults: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async create(data: {
    title: string;
    description: string;
    priority?: string;
    category?: string;
    createdById: string;
  }) {
    return prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        priority: (data.priority as any) || undefined,
        category: data.category as any,
        createdById: data.createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async update(id: string, data: Prisma.TicketUpdateInput) {
    return prisma.ticket.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.ticket.delete({ where: { id } });
  }
}

export const ticketRepository = new TicketRepository();
