import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { AiWorkerConfigSchema } from "@repo/shared";

// Load .env from backend root (ai-worker runs via tsx/Node, not Bun)
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

export const config = AiWorkerConfigSchema.parse(process.env);
