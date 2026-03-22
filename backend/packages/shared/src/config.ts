import { z } from "zod";

const BaseConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
});

export const GatewayConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  TICKET_SERVICE_URL: z.string().url().default("http://localhost:3001"),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
});

export const TicketServiceConfigSchema = BaseConfigSchema.extend({
  TICKET_SERVICE_PORT: z.coerce.number().default(3001),
});

export const AiWorkerConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  AI_PROVIDER: z.enum(["openai", "gemini", "mock"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
});

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type TicketServiceConfig = z.infer<typeof TicketServiceConfigSchema>;
export type AiWorkerConfig = z.infer<typeof AiWorkerConfigSchema>;
