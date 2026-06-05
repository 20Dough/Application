import { db } from "@/lib/db";
import { ok, badRequest, handleError } from "@/lib/api";
import { hashSecret } from "@/lib/crypto";
import { consumeAuthToken } from "@/lib/auth/tokens";

const MIN_PASSWORD_LENGTH = 6;

// POST /api/auth/reset-password — set a new password from a reset token.
export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    if (!token || !password)
      return badRequest("token and password are required");
    if (String(password).length < MIN_PASSWORD_LENGTH)
      return badRequest(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );

    const userId = await consumeAuthToken(String(token), "password_reset");
    if (!userId) return badRequest("This reset link is invalid or expired");

    const { hash, salt } = hashSecret(String(password));
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hash, passwordSalt: salt },
    });

    // Invalidate all existing sessions so a leaked one can't be reused.
    await db.session.deleteMany({ where: { userId } });

    return ok({ reset: true });
  } catch (err) {
    return handleError("POST /api/auth/reset-password", err);
  }
}
