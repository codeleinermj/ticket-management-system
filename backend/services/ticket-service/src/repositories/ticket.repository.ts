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
    assignedTo?: string;
    unassigned?: string;
    aiStatus?: string;
    confidenceMin?: string;
    confidenceMax?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const {
      page, limit, userId, role, status, priority, category, search,
      assignedTo, unassigned, aiStatus, confidenceMin, confidenceMax,
      dateFrom, dateTo, sortBy, sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};

    // Regular users only see their own tickets
    if (role === "USER") {
      where.createdById = userId;
    }

    // Basic filters
    if (status) where.status = status as any;
    if (priority) where.priority = priority as any;
    if (category) where.category = category as any;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Advanced filters
    if (assignedTo) where.assignedToId = assignedTo;
    if (unassigned === "true") where.assignedToId = null;
    if (aiStatus) where.aiStatus = aiStatus as any;
    if (confidenceMin || confidenceMax) {
      where.confidence = {};
      if (confidenceMin) (where.confidence as any).gte = parseFloat(confidenceMin);
      if (confidenceMax) (where.confidence as any).lte = parseFloat(confidenceMax);
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo + "T23:59:59.999Z");
    }

    // Sorting
    const orderByField = sortBy || "createdAt";
    const orderByDir = sortOrder === "asc" ? "asc" : "desc";
    const orderBy: any = { [orderByField]: orderByDir };

    const [data, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

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

  async findAllForExport(params: {
    userId?: string;
    role?: string;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    assignedTo?: string;
    aiStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    maxRows?: number;
  }) {
    const { userId, role, status, priority, category, search, assignedTo, aiStatus, dateFrom, dateTo, maxRows = 10000 } = params;
    const where: Prisma.TicketWhereInput = {};

    if (role === "USER") where.createdById = userId;
    if (status) where.status = status as any;
    if (priority) where.priority = priority as any;
    if (category) where.category = category as any;
    if (assignedTo) where.assignedToId = assignedTo;
    if (aiStatus) where.aiStatus = aiStatus as any;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as any).lte = new Date(dateTo + "T23:59:59.999Z");
    }

    const total = await prisma.ticket.count({ where });
    if (total > maxRows) {
      return { error: `Demasiados resultados (${total}). Aplica filtros para reducir a menos de ${maxRows}.`, data: [], total };
    }

    const data = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return { data, total };
  }

  async findManyByIds(ids: string[]) {
    return prisma.ticket.findMany({
      where: { id: { in: ids } },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
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
