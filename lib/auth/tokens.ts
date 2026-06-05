// Single-use auth tokens for email verification and password reset.
// Stored as opaque random strings in the AuthToken table. Server-side only.

import { randomBytes } from "crypto";
import { db } from "@/lib/db";

export type AuthTokenType = "verify_email" | "password_reset";

const TTL_MS: Record<AuthTokenType, number> = {
  verify_email: 24 * 60 * 60 * 1000, // 1 day
  password_reset: 60 * 60 * 1000, // 1 hour
};

/** Create a fresh token of a type for a user, replacing any existing ones. */
export async function createAuthToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  // Only one live token of a given type per user.
  await db.authToken.deleteMany({ where: { userId, type } });
  const token = randomBytes(32).toString("hex");
  await db.authToken.create({
    data: {
      token,
      type,
      userId,
      expiresAt: new Date(Date.now() + TTL_MS[type]),
    },
  });
  return token;
}

/**
 * Consume a token: return its userId if valid (right type, unexpired) and
 * delete it, or null otherwise. Single-use.
 */
export async function consumeAuthToken(
  token: string,
  type: AuthTokenType,
): Promise<string | null> {
  const row = await db.authToken.findUnique({ where: { token } });
  if (!row || row.type !== type) return null;

  // Always remove the row once looked up (used or expired).
  await db.authToken.delete({ where: { token } }).catch(() => {});
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row.userId;
}
