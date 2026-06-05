import { db } from "@/lib/db";
import { ok, badRequest, handleError } from "@/lib/api";
import { consumeAuthToken } from "@/lib/auth/tokens";

// POST /api/auth/verify-email — confirm an email from a token link.
export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) return badRequest("token is required");

    const userId = await consumeAuthToken(String(token), "verify_email");
    if (!userId)
      return badRequest("This verification link is invalid or expired");

    await db.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    return ok({ verified: true });
  } catch (err) {
    return handleError("POST /api/auth/verify-email", err);
  }
}
