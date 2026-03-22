declare const process: { env: Record<string, string | undefined> } | undefined;

export function createLogger(service: string) {
  const log = (level: string, message: string, ctx?: Record<string, unknown>) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      ...ctx,
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  };

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
    debug: (msg: string, ctx?: Record<string, unknown>) => {
      if (typeof process === "undefined" || process?.env?.NODE_ENV !== "production") {
        log("debug", msg, ctx);
      }
    },
  };
}
