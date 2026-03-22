import { prisma } from "../lib/prisma";

export class AuditRepository {
  async log(data: {
    action: string;
    ticketId: string;
    userId: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
  }) {
    return prisma.auditLog.create({ data });
  }

  async logChanges(
    ticketId: string,
    userId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
  ) {
    const changes: Array<{
      action: string;
      ticketId: string;
      userId: string;
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    for (const [key, newValue] of Object.entries(newData)) {
      if (newValue !== undefined && oldData[key] !== newValue) {
        changes.push({
          action: "UPDATE",
          ticketId,
          userId,
          field: key,
          oldValue: String(oldData[key] ?? ""),
          newValue: String(newValue),
        });
      }
    }

    if (changes.length > 0) {
      await prisma.auditLog.createMany({ data: changes });
    }

    return changes;
  }

  async getByTicketId(ticketId: string) {
    return prisma.auditLog.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });
  }
}

export const auditRepository = new AuditRepository();
