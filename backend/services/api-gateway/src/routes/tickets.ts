import { Hono } from "hono";
import { CreateTicketSchema, UpdateTicketSchema, CorrectAiClassificationSchema } from "@repo/shared";
import { authGuard, roleGuard } from "../middleware/auth";
import { config } from "../config";

export const ticketRoutes = new Hono();

// All ticket routes require auth
ticketRoutes.use("*", authGuard());

// List tickets (with pagination + filters)
ticketRoutes.get("/", async (c) => {
  const user = c.get("user");

  // Forward all query params (page, limit, status, priority, category, search)
  const queryString = c.req.url.split("?")[1] || "";

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets?${queryString}`, {
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// Get single ticket
ticketRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets/${id}`, {
    headers: {
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// Create ticket
ticketRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const validated = CreateTicketSchema.parse(body);
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
    body: JSON.stringify(validated),
  });

  return c.json(await res.json(), res.status as 200);
});

// Update ticket
ticketRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const validated = UpdateTicketSchema.parse(body);
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
    body: JSON.stringify(validated),
  });

  return c.json(await res.json(), res.status as 200);
});

// Accept AI classification (agent/admin only)
ticketRoutes.post("/:id/ai/accept", roleGuard("AGENT", "ADMIN"), async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets/${id}/ai/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
  });

  return c.json(await res.json(), res.status as 200);
});

// Correct AI classification (agent/admin only)
ticketRoutes.post("/:id/ai/correct", roleGuard("AGENT", "ADMIN"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const validated = CorrectAiClassificationSchema.parse(body);
  const user = c.get("user");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets/${id}/ai/correct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.sub,
      "x-user-role": user.role,
    },
    body: JSON.stringify(validated),
  });

  return c.json(await res.json(), res.status as 200);
});

// Delete ticket (admin only)
ticketRoutes.delete("/:id", roleGuard("ADMIN"), async (c) => {
  const id = c.req.param("id");

  const res = await fetch(`${config.TICKET_SERVICE_URL}/tickets/${id}`, {
    method: "DELETE",
  });

  return c.json(await res.json(), res.status as 200);
});
