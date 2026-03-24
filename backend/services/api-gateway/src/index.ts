import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { rateLimiter } from "./middleware/rate-limiter";
import { userRateLimiter } from "./middleware/user-rate-limiter";
import { zodErrorHandler } from "./middleware/zod-error-handler";
import { ticketRoutes } from "./routes/tickets";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { notificationRoutes } from "./routes/notifications";
import { slaRoutes } from "./routes/sla";
import { attachmentRoutes } from "./routes/attachments";
import { swaggerUI } from "@hono/swagger-ui";
import { openApiSpec } from "./openapi";
import { config } from "./config";
import { createServer } from "http";
import { createSocketServer } from "./ws/socket-server";
import { createLogger } from "@repo/shared";

const logger = createLogger("api-gateway");
const app = new Hono();

// Global middleware
app.use("*", honoLogger());
app.use("*", secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'", "ws://localhost:*", "wss://*"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
}));
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = config.CORS_ORIGINS.split(",");
      return allowed.includes(origin) ? origin : allowed[0];
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// Rate limiting (IP-based global)
app.use("*", rateLimiter({ windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX }));
app.use("/api/auth/*", rateLimiter({ windowMs: 60_000, max: 20 }));

// Per-user rate limiting (Redis-based, applied after auth)
app.use("/api/tickets", userRateLimiter({ windowSeconds: 60, max: 20, keyPrefix: "create-ticket" }));
app.use("/api/tickets/*/comments", userRateLimiter({ windowSeconds: 60, max: 30, keyPrefix: "comment" }));
app.use("/api/tickets/*/attachments", userRateLimiter({ windowSeconds: 60, max: 10, keyPrefix: "attachment" }));
app.use("/api/auth/forgot-password", rateLimiter({ windowMs: 60_000, max: 10 }));
app.use("/api/auth/resend-verification", userRateLimiter({ windowSeconds: 3600, max: 3, keyPrefix: "resend-verify" }));

// Error handler
app.onError(zodErrorHandler);

// Health check with downstream verification
app.get("/health", async (c) => {
  const checks: Record<string, string> = {};
  try {
    const res = await fetch(`${config.TICKET_SERVICE_URL}/health`);
    checks.ticketService = res.ok ? "ok" : "error";
  } catch {
    checks.ticketService = "error";
  }
  const allOk = Object.values(checks).every((v) => v === "ok");
  return c.json({
    status: allOk ? "ok" : "degraded",
    service: "api-gateway",
    checks,
    timestamp: new Date().toISOString(),
  }, allOk ? 200 : 503);
});

// API docs
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.get("/openapi.json", (c) => c.json(openApiSpec));

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/tickets", ticketRoutes);
app.route("/api/users", userRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/sla", slaRoutes);
app.route("/api/attachments", attachmentRoutes);

// 404
app.notFound((c) => {
  return c.json({ success: false, error: "Not Found" }, 404);
});

// Create HTTP server + Socket.io
const httpServer = createServer(async (req, res) => {
  const response = await app.fetch(
    new Request(`http://localhost:${config.PORT}${req.url}`, {
      method: req.method,
      headers: req.headers as any,
      body: req.method !== "GET" && req.method !== "HEAD"
        ? await new Promise<Buffer>((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
          })
        : undefined,
    })
  );

  // Build headers preserving multiple Set-Cookie values
  const headers: Record<string, string | string[]> = Object.fromEntries(response.headers.entries());
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length > 0) {
    headers["set-cookie"] = setCookies;
  }

  res.writeHead(response.status, headers);
  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
});

// Attach Socket.io to the HTTP server
createSocketServer(httpServer, config.REDIS_URL, config.CORS_ORIGINS);

httpServer.listen(config.PORT, () => {
  logger.info("API Gateway started", { port: config.PORT });
  logger.info("Swagger UI available", { url: `http://localhost:${config.PORT}/docs` });
  logger.info("WebSocket server attached");
});
