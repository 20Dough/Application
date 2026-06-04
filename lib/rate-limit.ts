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

/** Test helper: clear all rate-limit state. */
export function __resetRateLimits() {
  buckets.clear();
}
