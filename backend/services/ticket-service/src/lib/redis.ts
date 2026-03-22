import { Redis } from "ioredis";
import { createLogger } from "@repo/shared";

const logger = createLogger("ticket-service");

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redis.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message });
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});
