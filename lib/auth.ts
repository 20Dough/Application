import { db } from "@/lib/db";
import type { User } from "@prisma/client";

// Placeholder auth for MVP.
//
// Real authentication (e.g. Clerk) will replace this layer later. The
// abstraction is intentionally small — call sites only ever use
// getCurrentUser() / requireUser(), so swapping the implementation later does
// not ripple through the codebase.
//
// For development we auto-create (or return) a single stable dev user so the
// app is usable without a real auth provider.

const DEV_USER_EMAIL = "dev@hivemind.local";
const DEV_USER_NAME = "Dev User";

/**
 * Returns the current user, creating a stable dev user if none exists.
 *
 * When real auth is wired up this is where the session/token would be read.
 * For now it always resolves to the dev user so the app has a working identity.
 */
export async function getCurrentUser(): Promise<User | null> {
  const user = await db.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: {
      email: DEV_USER_EMAIL,
      name: DEV_USER_NAME,
    },
  });

  return user;
}

/**
 * Returns the current user or throws if there is none.
 *
 * Route handlers should catch this and translate it into a 401 response.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/** Thrown by requireUser() when no authenticated user is available. */
export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
