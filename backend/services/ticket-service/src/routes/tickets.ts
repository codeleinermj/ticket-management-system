import { Hono } from "hono";
import { ticketRepository } from "../repositories/ticket.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { ticketReadRepository } from "../repositories/ticket-read.repository";
import { webhookService } from "../services/webhook.service";
import { NotFoundError, ForbiddenError } from "@repo/shared";
import { sanitizeText } from "../lib/sanitize";
import { prisma } from "../lib/prisma";

export const ticketRoutes = new Hono();

// List tickets
ticketRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") || "1");
  const limit = Number(c.req.query("limit") || "20");
  const userId = c.req.header("x-user-id")!;
  const role = c.req.header("x-user-role")!;
  const status = c.req.query("status");
  const priority = c.req.query("priority");
  const category = c.req.query("category");
  const search = c.req.query("search");
  const assignedTo = c.req.query("assignedTo");
  const unassigned = c.req.query("unassigned");
  const aiStatus = c.req.query("aiStatus");
  const confidenceMin = c.req.query("confidenceMin");
  const confidenceMax = c.req.query("confidenceMax");
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");
  const sortBy = c.req.query("sortBy");
  const sortOrder = c.req.query("sortOrder");

  const result = await ticketRepository.findAll({
    page, limit, userId, role, status, priority, category, search,
    assignedTo, unassigned, aiStatus, confidenceMin, confidenceMax,
    dateFrom, dateTo, sortBy, sortOrder,
  });

  // Calculate hasNewMessage for each ticket
  const ticketIds = result.data.map((t: any) => t.id);
  if (ticketIds.length > 0) {
    const [readDates, lastCommentDates] = await Promise.all([
      ticketReadRepository.getLastReadDates(userId, ticketIds),
      ticketReadRepository.getLastCommentDates(ticketIds, userId),
    ]);

    result.data = result.data.map((ticket: any) => {
      const lastRead = readDates.get(ticket.id);
      const lastComment = lastCommentDates.get(ticket.id);
      const hasNewMessage = lastComment
        ? !lastRead || lastComment > lastRead
        : false;
      return { ...ticket, hasNewMessage };
    });
  }

  return c.json({ success: true, data: result });
});

// Get ticket by ID
ticketRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const ticket = await ticketRepository.findById(id);

  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  const role = c.req.header("x-user-role");
  const userId = c.req.header("x-user-id");
  if (role === "USER" && ticket.createdById !== userId) {
    throw new ForbiddenError("You can only view your own tickets");
  }

  // Mark ticket as read by this user
  await ticketReadRepository.markAsRead(userId!, id);

  return c.json({ success: true, data: ticket });
});

// Create ticket (atomic: ticket + audit log + outbox in one transaction)
ticketRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const userId = c.req.header("x-user-id")!;

  // Sanitize user input
  if (body.title) body.title = sanitizeText(body.title);
  if (body.description) body.description = sanitizeText(body.description);

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        title: body.title,
        description: body.description,
        priority: (body.priority as any) || undefined,
        category: body.category as any,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        ticketId: created.id,
        userId,
      },
    });

    await tx.outbox.create({
      data: {
        event: "ticket.created",
        payload: {
          ticketId: created.id,
          data: {
            title: created.title,
            description: created.description,
            category: created.category,
            priority: created.priority,
          },
        },
      },
    });

    return created;
  });

  return c.json({ success: true, data: ticket }, 201);
});

// Update ticket
ticketRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const userId = c.req.header("x-user-id")!;
  const role = c.req.header("x-user-role")!;

  const existing = await ticketRepository.findById(id);
  if (!existing) {
    throw new NotFoundError("Ticket not found");
  }

  // Sanitize user input
  if (body.title) body.title = sanitizeText(body.title);
  if (body.description) body.description = sanitizeText(body.description);

  // USERs can only update their own tickets, and only title/description
  if (role === "USER") {
    if (existing.createdById !== userId) {
      throw new ForbiddenError("You can only update your own tickets");
    }
    const { title, description } = body;
    const allowedFields: Record<string, unknown> = {};
    if (title !== undefined) allowedFields.title = title;
    if (description !== undefined) allowedFields.description = description;
    const ticket = await ticketRepository.update(id, allowedFields);
    await auditRepository.logChanges(id, userId, existing as any, allowedFields);
    return c.json({ success: true, data: ticket });
  }

  const ticket = await ticketRepository.update(id, body);

  await auditRepository.logChanges(id, userId, existing as any, body);

  // Notify on assignment
  if (body.assignedToId && body.assignedToId !== existing.assignedToId) {
    await notificationRepository.create({
      type: "assignment",
      title: "Ticket asignado",
      message: `Se te ha asignado el ticket "${existing.title}"`,
      ticketId: id,
      userId: body.assignedToId,
    });
  }

  // Notify ticket creator on status change
  if (body.status && body.status !== existing.status) {
    await notificationRepository.create({
      type: "status_change",
      title: "Estado actualizado",
      message: `Tu ticket "${existing.title}" cambió a ${body.status}`,
      ticketId: id,
      userId: existing.createdById,
    });
    await webhookService.emit("ticket.status_changed", id, {
      oldStatus: existing.status,
      newStatus: body.status,
      agentId: userId,
    });
  } else {
    await webhookService.emit("ticket.updated", id, body);
  }

  return c.json({ success: true, data: ticket });
});

// Export tickets
ticketRoutes.get("/export/csv", async (c) => {
  const userId = c.req.header("x-user-id")!;
  const role = c.req.header("x-user-role")!;

  if (role === "USER") {
    return c.json({ success: false, error: "Solo agentes y administradores pueden exportar" }, 403);
  }

  const result = await ticketRepository.findAllForExport({
    userId, role,
    status: c.req.query("status"),
    priority: c.req.query("priority"),
    category: c.req.query("category"),
    search: c.req.query("search"),
    assignedTo: c.req.query("assignedTo"),
    aiStatus: c.req.query("aiStatus"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
  });

  if (result.error) {
    return c.json({ success: false, error: result.error }, 400);
  }

  const headers = ["ID", "Titulo", "Descripcion", "Estado", "Prioridad", "Categoria", "Estado IA", "Confianza IA", "Creado por", "Asignado a", "Fecha creacion", "Fecha actualizacion"];
  const escape = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;

  const rows = result.data.map((t: any) => [
    t.id,
    escape(t.title),
    escape(t.description),
    t.status,
    t.priority || "",
    t.category || "",
    t.aiStatus,
    t.confidence?.toString() || "",
    t.createdBy?.name || "",
    t.assignedTo?.name || "",
    new Date(t.createdAt).toISOString(),
    new Date(t.updatedAt).toISOString(),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="tickets.csv"');
  return c.body(csv);
});

// Bulk actions
ticketRoutes.post("/bulk", async (c) => {
  const userId = c.req.header("x-user-id")!;
  const role = c.req.header("x-user-role")!;

  if (role === "USER") {
    return c.json({ success: false, error: "Solo agentes y administradores pueden usar acciones en bulk" }, 403);
  }

  const { ticketIds, action, data } = await c.req.json();

  if (!ticketIds || ticketIds.length === 0 || ticketIds.length > 50) {
    return c.json({ success: false, error: "Entre 1 y 50 tickets" }, 400);
  }

  if (action === "delete" && role !== "ADMIN") {
    return c.json({ success: false, error: "Solo administradores pueden eliminar en bulk" }, 403);
  }

  const results: { ticketId: string; status: string; error?: string }[] = [];

  for (const ticketId of ticketIds) {
    try {
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket) {
        results.push({ ticketId, status: "error", error: "Not found" });
        continue;
      }

      switch (action) {
        case "update_status":
          await ticketRepository.update(ticketId, { status: data.status as any });
          await auditRepository.log({ action: "BULK_STATUS_CHANGE", field: "status", oldValue: ticket.status, newValue: data.status, ticketId, userId });
          break;
        case "assign":
          await ticketRepository.update(ticketId, { assignedToId: data.assignedToId });
          await auditRepository.log({ action: "BULK_ASSIGN", field: "assignedToId", oldValue: ticket.assignedToId, newValue: data.assignedToId, ticketId, userId });
          break;
        case "update_priority":
          await ticketRepository.update(ticketId, { priority: data.priority as any });
          await auditRepository.log({ action: "BULK_PRIORITY_CHANGE", field: "priority", oldValue: ticket.priority, newValue: data.priority, ticketId, userId });
          break;
        case "delete":
          await ticketRepository.delete(ticketId);
          break;
      }

      await webhookService.emit(`ticket.${action === "delete" ? "deleted" : "updated"}`, ticketId, { bulkAction: action });
      results.push({ ticketId, status: "ok" });
    } catch (err: any) {
      results.push({ ticketId, status: "error", error: err.message });
    }
  }

  const processed = results.filter(r => r.status === "ok").length;
  const failed = results.filter(r => r.status === "error").length;

  return c.json({ success: true, data: { processed, failed, results } });
});

// Delete ticket
ticketRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await ticketRepository.findById(id);
  if (!existing) {
    throw new NotFoundError("Ticket not found");
  }

  await ticketRepository.delete(id);
  await webhookService.emit("ticket.deleted", id, { title: existing.title });

  return c.json({ success: true, data: { message: "Ticket deleted" } });
});
