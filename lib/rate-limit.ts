// Lightweight fixed-window rate limiter.
//
// In-memory by design: it protects a single instance with zero dependencies and
// is good enough for login/abuse throttling on a small deployment. For a
// multi-instance/serverless deployment, swap the Map for a shared store
// (Redis/Upstash) behind the same `rateLimit()` signature.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Periodically drop expired windows so the map can't grow without bound from
// one-off keys (e.g. IPs that never return). Cheap: runs at most once a minute.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, win] of buckets) {
    if (win.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Record a hit for `key` and report whether it is within the limit. */
export function rateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > opts.limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: opts.limit - existing.count, retryAfter };
}

/** Best-effort client identifier from proxy headers, falling back to a label. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Central rate-limit policy — one place to tune throttling for every endpoint.
 * login/register are keyed per client IP; messages per user.
 */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  messages: { limit: 30, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitOptions>;

/** Test helper: clear all rate-limit state. */
export function __resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
