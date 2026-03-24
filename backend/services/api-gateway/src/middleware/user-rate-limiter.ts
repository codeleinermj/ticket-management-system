import type { Context, MiddlewareHandler } from "hono";
import { redis } from "../lib/redis";
import type { JwtPayload } from "./auth";

interface UserRateLimitOptions {
  windowSeconds: number;
  max: number;
  keyPrefix: string;
}

export function userRateLimiter(options: UserRateLimitOptions): MiddlewareHandler {
  const { windowSeconds, max, keyPrefix } = options;

  return async (c: Context, next) => {
    const user = c.get("user") as JwtPayload | undefined;
    if (!user) {
      await next();
      return;
    }

    const key = `rl:${keyPrefix}:${user.sub}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    c.header("X-RateLimit-Limit", max.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, max - current).toString());

    if (current > max) {
      const ttl = await redis.ttl(key);
      c.header("Retry-After", (ttl > 0 ? ttl : windowSeconds).toString());
      return c.json(
        { success: false, error: "Demasiadas solicitudes. Intenta de nuevo mas tarde." },
        429
      );
    }

    await next();
  };
}
