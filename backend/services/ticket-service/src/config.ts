import { TicketServiceConfigSchema } from "@repo/shared";

export const config = TicketServiceConfigSchema.parse(process.env);
