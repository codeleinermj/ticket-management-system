import { z } from "zod";

export const TicketStatus = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "PENDING_MANUAL_REVIEW",
  "RESOLVED",
  "CLOSED",
]);

export const TicketPriority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const TicketCategory = z.enum([
  "BUG",
  "FEATURE_REQUEST",
  "SUPPORT",
  "BILLING",
  "OTHER",
]);

export const AiStatus = z.enum(["PENDING", "CLASSIFIED", "FAILED"]);

export const CreateTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  priority: TicketPriority.optional(),
  category: TicketCategory.optional(),
});

export const UpdateTicketSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  status: TicketStatus.optional(),
  priority: TicketPriority.optional(),
  category: TicketCategory.optional(),
  assignedToId: z.string().uuid().optional(),
});

export const CorrectAiClassificationSchema = z.object({
  category: TicketCategory.optional(),
  priority: TicketPriority.optional(),
}).refine((data) => data.category || data.priority, {
  message: "At least one field (category or priority) must be provided",
});

export type TicketStatus = z.infer<typeof TicketStatus>;
export type TicketPriority = z.infer<typeof TicketPriority>;
export type TicketCategory = z.infer<typeof TicketCategory>;
export type AiStatus = z.infer<typeof AiStatus>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type CorrectAiClassificationInput = z.infer<typeof CorrectAiClassificationSchema>;
