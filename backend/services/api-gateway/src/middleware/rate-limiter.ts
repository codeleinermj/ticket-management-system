import type { Context, MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

const clients = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max } = options;

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of clients) {
      if (now > value.resetTime) {
        clients.delete(key);
      }
    }
  }, windowMs);

  return async (c: Context, next) => {
    const key = c.req.header("x-forwarded-for") || "unknown";
    const now = Date.now();

    const client = clients.get(key);

    if (!client || now > client.resetTime) {
      clients.set(key, { count: 1, resetTime: now + windowMs });
      c.header("X-RateLimit-Limit", max.toString());
      c.header("X-RateLimit-Remaining", (max - 1).toString());
      await next();
      return;
    }

    client.count++;

    if (client.count > max) {
      c.header("Retry-After", Math.ceil((client.resetTime - now) / 1000).toString());
      return c.json(
        { success: false, error: "Too many requests. Please try again later." },
        429
      );
    }

    c.header("X-RateLimit-Limit", max.toString());
    c.header("X-RateLimit-Remaining", (max - client.count).toString());
    await next();
  };
}
