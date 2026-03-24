import { Hono } from "hono";
import { authGuard, roleGuard } from "../middleware/auth";
import { config } from "../config";

export const slaRoutes = new Hono();

slaRoutes.use("*", authGuard());

// Get all SLA configs
slaRoutes.get("/", async (c) => {
  const res = await fetch(`${config.TICKET_SERVICE_URL}/sla`);
  return c.json(await res.json(), res.status as 200);
});

// Update SLA config (admin only)
slaRoutes.patch("/:priority", roleGuard("ADMIN"), async (c) => {
  const priority = c.req.param("priority");
  const user = c.get("user");
  const body = await c.req.json();

  const res = await fetch(`${config.TICKET_SERVICE_URL}/sla/${priority}`, {
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
