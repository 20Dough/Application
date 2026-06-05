// Minimal structured logger + error-reporting seam.
//
// Logs JSON in production (easy to ship to a log aggregator) and a readable line
// in development. `captureException` is where an error monitor (e.g. Sentry)
// would hook in — wire it up by setting SENTRY_DSN and forwarding here.

import { reportException } from "@/lib/monitoring";

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const line = JSON.stringify({
      level,
      message,
      ...meta,
      time: new Date().toISOString(),
    });
    (level === "error" ? console.error : console.log)(line);
  } else {
    const tag = `[${level}]`;
    (level === "error" ? console.error : console.log)(tag, message, meta ?? "");
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    emit("error", message, meta),
};

/**
 * Report an unexpected error. Logs it and (when configured) forwards to an
 * external monitor. Returns nothing; never throws.
 */
export function captureException(
  scope: string,
  error: unknown,
  meta?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`[${scope}] ${message}`, { ...meta, stack });

  // Forward to Sentry when configured (no-op otherwise).
  reportException(error, { scope, ...meta });
}
