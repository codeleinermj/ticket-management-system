import { Hono } from "hono";
import { notificationRepository } from "../repositories/notification.repository";

export const notificationRoutes = new Hono();

// Get user notifications
notificationRoutes.get("/", async (c) => {
  const userId = c.req.header("x-user-id")!;
  const limit = Number(c.req.query("limit") || "20");
  const unreadOnly = c.req.query("unreadOnly") === "true";

  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.findByUserId(userId, { limit, unreadOnly }),
    notificationRepository.countUnread(userId),
  ]);

  return c.json({ success: true, data: { notifications, unreadCount } });
});

// Mark notification as read
notificationRoutes.patch("/:id/read", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.header("x-user-id")!;

  await notificationRepository.markAsRead(id, userId);
  return c.json({ success: true, data: { message: "Marked as read" } });
});

// Mark all notifications as read
notificationRoutes.post("/read-all", async (c) => {
  const userId = c.req.header("x-user-id")!;

  await notificationRepository.markAllAsRead(userId);
  return c.json({ success: true, data: { message: "All marked as read" } });
});
