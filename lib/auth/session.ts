// Login sessions backed by the Session table + an httpOnly cookie.
//
// A random opaque token is stored in the cookie and looked up server-side, so
// the client can never read or forge a session. Server-side only.

import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const COOKIE_NAME = "hivemind_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** Create a session for a user and set the session cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { token, userId, expiresAt } });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the logged-in user from the session cookie, or null. */
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Destroy the current session (logout): delete the row and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.session.delete({ where: { token } }).catch(() => {});
  }
  store.delete(COOKIE_NAME);
}
