import { GatewayConfigSchema } from "@repo/shared";

export const config = GatewayConfigSchema.parse(process.env);
