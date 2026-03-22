import { AiWorkerConfigSchema } from "@repo/shared";

export const config = AiWorkerConfigSchema.parse(process.env);
