import type { AIClassifier, TicketInput } from "./classifiers";
import { PrismaClient } from "@repo/database";
import { createLogger } from "@repo/shared";
import type { Redis } from "ioredis";

const prisma = new PrismaClient();
const logger = createLogger("ai-worker");

const RETRY_DELAYS = [1000, 4000, 16000];

async function classifyWithRetry(
  classifier: AIClassifier,
  input: TicketInput,
  maxAttempts = 3,
) {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await classifier.classify(input);
    } catch (err) {
      lastError = err as Error;
      logger.warn("Classification attempt failed", {
        attempt: attempt + 1,
        maxAttempts,
        error: lastError.message,
      });
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  throw lastError;
}

interface TicketData extends TicketInput {
  category?: string;
  priority?: string;
}

export async function processTicket(
  ticketId: string,
  data: TicketData,
  classifier: AIClassifier,
  publisher: Redis,
) {
  try {
    const classification = await classifyWithRetry(classifier, data);

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        category: classification.category as any,
        priority: classification.priority as any,
        aiResponse: classification.suggestedResponse,
        aiStatus: "CLASSIFIED",
        confidence: classification.confidence,
      },
    });

    await prisma.aiResult.create({
      data: {
        ticketId,
        provider: classifier.name,
        category: classification.category as any,
        priority: classification.priority as any,
        suggestedResponse: classification.suggestedResponse,
        confidence: classification.confidence,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "AI_CLASSIFICATION",
        ticketId,
        userId: null,
        field: "category",
        oldValue: data.category || "none",
        newValue: classification.category,
      },
    });

    await publisher.publish(
      "ticket-events",
      JSON.stringify({
        event: "ticket.classified",
        ticketId,
        data: {
          category: classification.category,
          priority: classification.priority,
          aiResponse: classification.suggestedResponse,
          confidence: classification.confidence,
          provider: classifier.name,
        },
        timestamp: new Date().toISOString(),
      }),
    );

    logger.info("Ticket classified", {
      ticketId,
      category: classification.category,
      priority: classification.priority,
      provider: classifier.name,
      confidence: classification.confidence,
    });
  } catch (err) {
    logger.error("Failed to process ticket", {
      ticketId,
      error: (err as Error).message,
    });

    try {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: "PENDING_MANUAL_REVIEW",
          aiStatus: "FAILED",
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "AI_CLASSIFICATION_FAILED",
          ticketId,
          userId: null,
          field: "status",
          newValue: "PENDING_MANUAL_REVIEW",
        },
      });

      logger.info("Ticket marked as PENDING_MANUAL_REVIEW", { ticketId });
    } catch (dbErr) {
      logger.error("Failed to update ticket status after classification failure", {
        ticketId,
        error: (dbErr as Error).message,
      });
    }

    await publisher.publish(
      "ticket-events",
      JSON.stringify({
        event: "ticket.ai_failed",
        ticketId,
        data: { error: (err as Error).message },
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
