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
  confidenceThreshold: number = 0.6,
) {
  try {
    // Check if already classified (guard against duplicate processing)
    const current = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { aiStatus: true },
    });
    if (current?.aiStatus === "CLASSIFIED") {
      logger.info("Ticket already classified, skipping", { ticketId });
      return;
    }

    const classification = await classifyWithRetry(classifier, data);

    const belowThreshold = classification.confidence < confidenceThreshold;

    if (belowThreshold) {
      // Low confidence: save AI result for agent review but don't auto-apply
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          aiResponse: classification.suggestedResponse,
          aiStatus: "PENDING",
          confidence: classification.confidence,
          status: "PENDING_MANUAL_REVIEW",
        },
      });

      logger.info("Low confidence classification — pending manual review", {
        ticketId,
        confidence: classification.confidence,
        threshold: confidenceThreshold,
      });
    } else {
      // High confidence: auto-apply category/priority
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

      logger.info("Ticket classified", {
        ticketId,
        category: classification.category,
        priority: classification.priority,
        provider: classifier.name,
        confidence: classification.confidence,
      });
    }

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
        action: belowThreshold ? "AI_LOW_CONFIDENCE" : "AI_CLASSIFICATION",
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
        event: belowThreshold ? "ticket.low_confidence" : "ticket.classified",
        ticketId,
        data: {
          category: classification.category,
          priority: classification.priority,
          aiResponse: classification.suggestedResponse,
          confidence: classification.confidence,
          provider: classifier.name,
          belowThreshold,
        },
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (err) {
    logger.error("Failed to process ticket", {
      ticketId,
      error: (err as Error).message,
    });

    try {
      // Only mark as FAILED if not already classified by another worker
      const current = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { aiStatus: true },
      });
      if (current?.aiStatus === "CLASSIFIED") {
        logger.info("Ticket already classified by another worker, skipping failure", { ticketId });
        return;
      }

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
