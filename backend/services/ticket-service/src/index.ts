import { Hono } from "hono";
import { ticketRoutes } from "./routes/tickets";
import { authRoutes } from "./routes/auth";
import { aiFeedbackRoutes } from "./routes/ai-feedback";
import { userRoutes } from "./routes/users";
import { commentRoutes } from "./routes/comments";
import { notificationRoutes } from "./routes/notifications";
import { slaRoutes } from "./routes/sla";
import { attachmentRoutes } from "./routes/attachments";
import { slaRepository } from "./repositories/sla.repository";
import { startOutboxProcessor, stopOutboxProcessor } from "./services/outbox.service";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { config } from "./config";
import { createLogger, AppError } from "@repo/shared";

const logger = createLogger("ticket-service");
const app = new Hono();

// Error handler — convert AppError/ZodError to JSON responses
app.onError((err, c) => {
  if (err.name === "ZodError") {
    const zodErr = err as any;
    return c.json({
      success: false,
      error: "Validation failed",
      details: zodErr.errors?.map((e: any) => ({ field: e.path.join("."), message: e.message })),
    }, 400);
  }

  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: err.message,
      code: err.statusCode === 401 ? "UNAUTHORIZED" : undefined,
    }, err.statusCode as any);
  }

  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  return c.json({ success: false, error: "Internal server error" }, 500);
});

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
app.route("/tickets", commentRoutes);
app.route("/users", userRoutes);
app.route("/notifications", notificationRoutes);
app.route("/sla", slaRoutes);
app.route("/tickets", attachmentRoutes);
app.route("", attachmentRoutes);

const port = config.TICKET_SERVICE_PORT;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info("Ticket Service started", { port });

// Seed SLA defaults
slaRepository.seed().catch(() => {});

// Start outbox processor (publishes events to Redis)
startOutboxProcessor();

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down");
  stopOutboxProcessor();
  await prisma.$disconnect();
  redis.disconnect();
  server.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
