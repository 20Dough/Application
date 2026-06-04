import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientIp, __resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => __resetRateLimits());

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit("k", opts).ok).toBe(true); // 1
    expect(rateLimit("k", opts).ok).toBe(true); // 2
    const third = rateLimit("k", opts); // 3
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = rateLimit("k", opts); // 4 → over
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("b", opts).ok).toBe(true); // different key, fresh window
    expect(rateLimit("a", opts).ok).toBe(false);
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: -1 }; // already-expired window
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(true); // window expired → reset
  });
});

describe("clientIp", () => {
  it("reads the first x-forwarded-for entry", () => {
    const req = new Request("http://t", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back when no proxy header is present", () => {
    expect(clientIp(new Request("http://t"))).toBe("unknown");
  });
});
