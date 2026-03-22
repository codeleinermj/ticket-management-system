import { z } from "zod";

export const ClassificationSchema = z.object({
  category: z.enum(["BUG", "FEATURE_REQUEST", "SUPPORT", "BILLING", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  suggestedResponse: z.string(),
  confidence: z.number().min(0).max(1),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export interface TicketInput {
  title: string;
  description: string;
}

export interface AIClassifier {
  name: string;
  classify(ticket: TicketInput): Promise<Classification>;
}

export const SYSTEM_PROMPT = `You are a support ticket classifier. Analyze the ticket and return a JSON object with:
- "category": one of "BUG", "FEATURE_REQUEST", "SUPPORT", "BILLING", "OTHER"
- "priority": one of "LOW", "MEDIUM", "HIGH", "CRITICAL"
- "suggestedResponse": a helpful draft response for the support agent (in Spanish)
- "confidence": your confidence level from 0 to 1

Rules:
- CRITICAL priority: system down, data loss, security breach
- HIGH priority: major feature broken, many users affected
- MEDIUM priority: minor feature issue, workaround available
- LOW priority: cosmetic issues, questions, feature requests`;
