import { Redis } from "ioredis";
import { processTicket } from "./processor";
import { createClassifier } from "./classifiers";
import { createLogger } from "@repo/shared";
import { config } from "./config";

const logger = createLogger("ai-worker");

const classifier = createClassifier({
  provider: config.AI_PROVIDER,
  openaiApiKey: config.OPENAI_API_KEY,
  openaiModel: config.OPENAI_MODEL,
  geminiApiKey: config.GEMINI_API_KEY,
  geminiModel: config.GEMINI_MODEL,
});

const subscriber = new Redis(config.REDIS_URL);
const publisher = new Redis(config.REDIS_URL);

subscriber.on("connect", () => {
  logger.info("Connected to Redis (subscriber)");
});

publisher.on("connect", () => {
  logger.info("Connected to Redis (publisher)");
});

subscriber.on("error", (err) => {
  logger.error("Redis subscriber error", { error: err.message });
});

publisher.on("error", (err) => {
  logger.error("Redis publisher error", { error: err.message });
});

subscriber.subscribe("ticket-events", (err) => {
  if (err) {
    logger.error("Failed to subscribe to ticket-events", { error: err.message });
    process.exit(1);
  }
  logger.info("Listening for ticket events");
});

subscriber.on("message", async (_channel, message) => {
  try {
    const event = JSON.parse(message);

    if (event.event === "ticket.created") {
      logger.info("Processing new ticket", { ticketId: event.ticketId });
      await processTicket(event.ticketId, event.data, classifier, publisher);
    }
  } catch (err) {
    logger.error("Error processing message", { error: (err as Error).message });
  }
});

// Graceful shutdown
const shutdown = () => {
  logger.info("Shutting down");
  subscriber.disconnect();
  publisher.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const model = config.AI_PROVIDER === "openai" ? config.OPENAI_MODEL : config.AI_PROVIDER === "gemini" ? config.GEMINI_MODEL : "n/a";
logger.info("AI Worker started", { provider: classifier.name, model });
