import { vi, beforeEach } from "vitest";

// Mock Next's cookie store so session code works in tests (see cookie-store.ts).
vi.mock("next/headers", async () => {
  const { cookieStore } = await import("./cookie-store");
  return { cookies: async () => cookieStore };
});

import { resetDb } from "./db";
import { cookieStore } from "./cookie-store";
import { __resetRateLimits } from "@/lib/rate-limit";

// Each test starts from an empty database, no session, and fresh rate limits.
beforeEach(async () => {
  await resetDb();
  cookieStore.__reset();
  __resetRateLimits();
});
