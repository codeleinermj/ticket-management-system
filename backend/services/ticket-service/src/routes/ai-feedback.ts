import { Hono } from "hono";
import { prisma } from "../lib/prisma";
import { ticketRepository } from "../repositories/ticket.repository";
import { auditRepository } from "../repositories/audit.repository";
import { webhookService } from "../services/webhook.service";
import { NotFoundError } from "@repo/shared";

export const aiFeedbackRoutes = new Hono();

// Accept AI classification
aiFeedbackRoutes.post("/:id/ai/accept", async (c) => {
  const ticketId = c.req.param("id");
  const userId = c.req.header("x-user-id")!;

  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  // Mark the latest AiResult as accepted
  const latestAiResult = ticket.aiResults?.[0];
  if (latestAiResult) {
    await prisma.aiResult.update({
      where: { id: latestAiResult.id },
      data: { accepted: true },
    });
  }

  await auditRepository.log({
    action: "AI_ACCEPTED",
    ticketId,
    userId,
    field: "aiResult",
    newValue: "accepted",
  });

  await webhookService.emit("ticket.updated", ticketId, {
    aiAccepted: true,
    agentId: userId,
  });

  return c.json({ success: true, data: { message: "AI classification accepted" } });
});

// Correct AI classification
aiFeedbackRoutes.post("/:id/ai/correct", async (c) => {
  const ticketId = c.req.param("id");
  const body = await c.req.json();
  const userId = c.req.header("x-user-id")!;

  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) {
    throw new NotFoundError("Ticket not found");
  }

  // Mark the latest AiResult as rejected
  const latestAiResult = ticket.aiResults?.[0];
  if (latestAiResult) {
    await prisma.aiResult.update({
      where: { id: latestAiResult.id },
      data: { accepted: false },
    });
  }

  // Apply corrections to the ticket
  const updates: Record<string, unknown> = {};
  if (body.category) updates.category = body.category;
  if (body.priority) updates.priority = body.priority;

  if (Object.keys(updates).length > 0) {
    await ticketRepository.update(ticketId, updates);
  }

  // Log each corrected field
  if (body.category && body.category !== ticket.category) {
    await auditRepository.log({
      action: "AI_CORRECTED",
      ticketId,
      userId,
      field: "category",
      oldValue: ticket.category || "none",
      newValue: body.category,
    });
  }

  if (body.priority && body.priority !== ticket.priority) {
    await auditRepository.log({
      action: "AI_CORRECTED",
      ticketId,
      userId,
      field: "priority",
      oldValue: ticket.priority || "none",
      newValue: body.priority,
    });
  }

  await webhookService.emit("ticket.updated", ticketId, {
    aiCorrected: true,
    corrections: updates,
    agentId: userId,
  });

  const updated = await ticketRepository.findById(ticketId);
  return c.json({ success: true, data: updated });
});
