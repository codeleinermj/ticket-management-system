import { Hono } from "hono";
import { UserRole } from "@repo/shared";
import { authGuard, roleGuard } from "../middleware/auth";
import { config } from "../config";

export const userRoutes = new Hono();

// All user routes require auth
userRoutes.use("*", authGuard());

// Get agents list (for assignment dropdown — agents and admins can access)
userRoutes.get("/agents", roleGuard("AGENT", "ADMIN"), async (c) => {
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/users/agents`, {
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// List all users (admin only)
userRoutes.get("/", roleGuard("ADMIN"), async (c) => {
  const user = c.get("user");
  const queryString = c.req.url.split("?")[1] || "";

  const res = await fetch(`${config.TICKET_SERVICE_URL}/users?${queryString}`, {
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// Update user role (admin only)
userRoutes.patch("/:id/role", roleGuard("ADMIN"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/users/${id}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
    body: JSON.stringify(body),
  });

  return c.json(await res.json(), res.status as 200);
});

// Toggle user active status (admin only)
userRoutes.patch("/:id/active", roleGuard("ADMIN"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/users/${id}/active`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
    body: JSON.stringify(body),
  });

  return c.json(await res.json(), res.status as 200);
});
