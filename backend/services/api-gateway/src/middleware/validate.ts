import type { Context, MiddlewareHandler } from "hono";
import type { AnyZodObject } from "zod";

export function validate(schema: AnyZodObject): MiddlewareHandler {
  return async (c: Context, next) => {
    const body = await c.req.json();
    const validated = schema.parse(body);
    c.set("validatedBody", validated);
    await next();
  };
}
