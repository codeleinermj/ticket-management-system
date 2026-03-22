import { Hono } from "hono";
import { userRepository } from "../repositories/user.repository";
import { NotFoundError } from "@repo/shared";

export const userRoutes = new Hono();

// List all users (admin only — access control enforced at api-gateway)
userRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") || "1");
  const limit = Number(c.req.query("limit") || "20");
  const role = c.req.query("role");
  const search = c.req.query("search");

  const result = await userRepository.findAll({ page, limit, role, search });
  return c.json({ success: true, data: result });
});

// List agents (for assignment dropdown)
userRoutes.get("/agents", async (c) => {
  const agents = await userRepository.findAgents();
  return c.json({ success: true, data: agents });
});

// Update user role (admin only)
userRoutes.patch("/:id/role", async (c) => {
  const id = c.req.param("id");
  const { role } = await c.req.json();

  const existing = await userRepository.findById(id);
  if (!existing) throw new NotFoundError("User not found");

  const user = await userRepository.updateRole(id, role);
  return c.json({ success: true, data: user });
});

// Toggle user active status (admin only)
userRoutes.patch("/:id/active", async (c) => {
  const id = c.req.param("id");
  const { isActive } = await c.req.json();

  const existing = await userRepository.findById(id);
  if (!existing) throw new NotFoundError("User not found");

  const user = await userRepository.toggleActive(id, isActive);
  return c.json({ success: true, data: user });
});
