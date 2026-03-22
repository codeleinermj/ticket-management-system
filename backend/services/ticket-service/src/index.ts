import { Hono } from "hono";
import { ticketRoutes } from "./routes/tickets";
import { authRoutes } from "./routes/auth";
import { aiFeedbackRoutes } from "./routes/ai-feedback";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { config } from "./config";
import { createLogger } from "@repo/shared";

const logger = createLogger("ticket-service");
const app = new Hono();

// Health check with Redis + DB verification
app.get("/health", async (c) => {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }
  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }
  const allOk = Object.values(checks).every((v) => v === "ok");
  return c.json({
    status: allOk ? "ok" : "degraded",
    service: "ticket-service",
    checks,
    timestamp: new Date().toISOString(),
  }, allOk ? 200 : 503);
});

// Routes
app.route("/auth", authRoutes);
app.route("/tickets", ticketRoutes);
app.route("/tickets", aiFeedbackRoutes);

const port = config.TICKET_SERVICE_PORT;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info("Ticket Service started", { port });

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down");
  await prisma.$disconnect();
  redis.disconnect();
  server.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
