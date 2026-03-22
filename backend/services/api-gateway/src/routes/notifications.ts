import { Hono } from "hono";
import { authGuard } from "../middleware/auth";
import { config } from "../config";

export const notificationRoutes = new Hono();

notificationRoutes.use("*", authGuard());

// Get notifications
notificationRoutes.get("/", async (c) => {
  const user = c.get("user");
  const queryString = c.req.url.split("?")[1] || "";

  const res = await fetch(`${config.TICKET_SERVICE_URL}/notifications?${queryString}`, {
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// Mark notification as read
notificationRoutes.patch("/:id/read", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/notifications/${id}/read`, {
    method: "PATCH",
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// Mark all as read
notificationRoutes.post("/read-all", async (c) => {
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/notifications/read-all`, {
    method: "POST",
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});
