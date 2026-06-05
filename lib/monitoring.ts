// Error monitoring via Sentry. Entirely optional: with no SENTRY_DSN this is a
// no-op and Sentry is never even imported. Lazy dynamic import keeps the SDK out
// of any bundle that doesn't actually report.

type SentryModule = typeof import("@sentry/node");

let sentry: SentryModule | null = null;
let initPromise: Promise<void> | null = null;

/** Initialize Sentry once, if SENTRY_DSN is configured. Safe to call repeatedly. */
export async function initMonitoring(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (!initPromise) {
    initPromise = import("@sentry/node").then((S) => {
      S.init({
        dsn,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0, // error reporting only, no perf tracing
      });
      sentry = S;
    });
  }
  return initPromise;
}

/** Forward an exception to Sentry when configured; otherwise a no-op. */
export function reportException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  if (!sentry) return;
  sentry.captureException(error, extra ? { extra } : undefined);
}
