import { Hono } from "hono";
import { ticketRepository } from "../repositories/ticket.repository";
import { auditRepository } from "../repositories/audit.repository";
import { webhookService } from "../services/webhook.service";
import { NotFoundError, ForbiddenError } from "@repo/shared";

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

  const result = await ticketRepository.findAll({
    page, limit, userId, role, status, priority, category, search,
  });
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

  return c.json({ success: true, data: ticket });
});

// Create ticket
ticketRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const userId = c.req.header("x-user-id")!;

  const ticket = await ticketRepository.create({
    ...body,
    createdById: userId,
  });

  await auditRepository.log({
    action: "CREATE",
    ticketId: ticket.id,
    userId,
  });

  await webhookService.emit("ticket.created", ticket.id, {
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
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

  if (body.status && body.status !== existing.status) {
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
