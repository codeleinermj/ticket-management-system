import { Hono } from "hono";
import { slaRepository } from "../repositories/sla.repository";

export const slaRoutes = new Hono();

// Get all SLA configs
slaRoutes.get("/", async (c) => {
  const configs = await slaRepository.findAll();
  return c.json({ success: true, data: configs });
});

// Update SLA config (admin only)
slaRoutes.patch("/:priority", async (c) => {
  const priority = c.req.param("priority");
  const role = c.req.header("x-user-role");

  if (role !== "ADMIN") {
    return c.json({ success: false, error: "Admin only" }, 403);
  }

  const { maxResponseMinutes } = await c.req.json();
  const config = await slaRepository.upsert(priority, maxResponseMinutes);
  return c.json({ success: true, data: config });
});
