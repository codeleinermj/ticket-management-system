import type { Context } from "hono";
import { ZodError } from "zod";
import { AppError, createLogger } from "@repo/shared";

const logger = createLogger("api-gateway");

export function zodErrorHandler(err: Error, c: Context) {
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: "Validation Error",
        code: "VALIDATION_ERROR",
        details: err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      },
      400
    );
  }

  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: err.message,
        code: err.constructor.name.replace(/Error$/, "").toUpperCase() || "APP_ERROR",
        ...("errors" in err && { details: (err as any).errors }),
      },
      err.statusCode as 400
    );
  }

  logger.error("Unhandled error", { error: err.message, stack: err.stack });

  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message;

  return c.json({ success: false, error: message, code: "INTERNAL_ERROR" }, 500);
}
