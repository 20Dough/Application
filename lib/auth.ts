// Auth helpers built on database-backed sessions (see lib/session.ts).
//
// getCurrentUser() returns the signed-in user or null. API routes should treat
// null as unauthorized. The abstraction stays thin so a real provider (e.g.
// Clerk) can replace the session lookup later without touching call sites.

import { cache } from "react";
import { getSessionUser } from "@/lib/session";

// Wrapped in React's `cache` so multiple calls within the same server request
// resolve the session only once.
export const getCurrentUser = cache(async () => {
  return getSessionUser();
});

/** Like getCurrentUser but throws if not signed in — handy in route handlers. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}
