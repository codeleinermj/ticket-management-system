import { redis } from "../lib/redis";
import { createLogger } from "@repo/shared";

const logger = createLogger("ticket-service");

export type WebhookEvent =
  | "ticket.created"
  | "ticket.updated"
  | "ticket.status_changed"
  | "ticket.deleted"
  | "comment.created";

interface WebhookPayload {
  event: WebhookEvent;
  ticketId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export class WebhookService {
  async emit(event: WebhookEvent, ticketId: string, data: Record<string, unknown>) {
    const payload: WebhookPayload = {
      event,
      ticketId,
      data,
      timestamp: new Date().toISOString(),
    };

    await redis.publish("ticket-events", JSON.stringify(payload));
    logger.info("Event emitted", { event, ticketId });
  }
}

export const webhookService = new WebhookService();
