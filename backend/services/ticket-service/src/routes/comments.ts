import { Hono } from "hono";
import { commentRepository } from "../repositories/comment.repository";
import { ticketRepository } from "../repositories/ticket.repository";
import { userRepository } from "../repositories/user.repository";
import { notificationRepository } from "../repositories/notification.repository";
import { webhookService } from "../services/webhook.service";
import { NotFoundError, ForbiddenError } from "@repo/shared";
import { sanitizeText } from "../lib/sanitize";

export const commentRoutes = new Hono();

// List comments for a ticket
commentRoutes.get("/:ticketId/comments", async (c) => {
  const ticketId = c.req.param("ticketId");
  const comments = await commentRepository.findByTicketId(ticketId);
  return c.json({ success: true, data: comments });
});

// Add a comment to a ticket
commentRoutes.post("/:ticketId/comments", async (c) => {
  const ticketId = c.req.param("ticketId");
  const userId = c.req.header("x-user-id")!;
  const userRole = c.req.header("x-user-role")!;
  const body = await c.req.json();
  const content = sanitizeText(body.content);

  const commenter = await userRepository.findById(userId);
  const userName = commenter?.name || "Usuario";

  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new NotFoundError("Ticket not found");

  // Users can only comment on their own tickets
  if (userRole === "USER" && ticket.createdById !== userId) {
    throw new ForbiddenError("You can only comment on your own tickets");
  }

  const comment = await commentRepository.create({ content, ticketId, userId });

  // Set firstResponseAt if this is the first agent/admin comment
  if ((userRole === "AGENT" || userRole === "ADMIN") && !ticket.firstResponseAt) {
    await ticketRepository.update(ticketId, { firstResponseAt: new Date() } as any);
  }

  // Notify relevant users
  const notifyUserIds = new Set<string>();

  // Notify ticket creator if commenter is not the creator
  if (ticket.createdById !== userId) {
    notifyUserIds.add(ticket.createdById);
  }

  // Notify assigned agent if commenter is not the assignee
  if (ticket.assignedToId && ticket.assignedToId !== userId) {
    notifyUserIds.add(ticket.assignedToId);
  }

  if (notifyUserIds.size > 0) {
    const notifications = Array.from(notifyUserIds).map((uid) => ({
      type: "comment",
      title: "Nuevo comentario",
      message: `${userName} comentó en el ticket "${ticket.title}"`,
      ticketId,
      userId: uid,
    }));
    await notificationRepository.createMany(notifications);
  }

  await webhookService.emit("comment.created", ticketId, {
    commentId: comment.id,
    userId,
    userName,
    userRole,
    content: content.length > 100 ? content.slice(0, 100) + "..." : content,
    createdAt: comment.createdAt,
  });

  return c.json({ success: true, data: comment }, 201);
});

// Delete a comment
commentRoutes.delete("/:ticketId/comments/:commentId", async (c) => {
  const commentId = c.req.param("commentId");
  const userId = c.req.header("x-user-id")!;
  const userRole = c.req.header("x-user-role")!;

  const comment = await commentRepository.findById(commentId);
  if (!comment) throw new NotFoundError("Comment not found");

  // Only comment author or admin can delete
  if (comment.userId !== userId && userRole !== "ADMIN") {
    throw new ForbiddenError("Not authorized to delete this comment");
  }

  await commentRepository.delete(commentId);
  return c.json({ success: true, data: { message: "Comment deleted" } });
});
