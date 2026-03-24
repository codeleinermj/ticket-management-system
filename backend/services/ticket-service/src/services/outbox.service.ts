import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { createLogger } from "@repo/shared";

const logger = createLogger("outbox");

const POLL_INTERVAL_MS = 2000;

export async function processOutbox() {
  const pending = await prisma.outbox.findMany({
    where: { published: false },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const entry of pending) {
    try {
      await redis.publish("ticket-events", JSON.stringify({
        event: entry.event,
        ...entry.payload as object,
        timestamp: entry.createdAt.toISOString(),
      }));

      await prisma.outbox.update({
        where: { id: entry.id },
        data: { published: true },
      });
    } catch (err) {
      logger.error("Failed to publish outbox entry", {
        id: entry.id,
        error: (err as Error).message,
      });
    }
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startOutboxProcessor() {
  intervalId = setInterval(() => {
    processOutbox().catch((err) => {
      logger.error("Outbox processor error", { error: (err as Error).message });
    });
  }, POLL_INTERVAL_MS);
  logger.info("Outbox processor started", { intervalMs: POLL_INTERVAL_MS });
}

export function stopOutboxProcessor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
