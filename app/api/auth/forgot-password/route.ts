import { db } from "@/lib/db";
import { ok, badRequest, tooManyRequests, handleError } from "@/lib/api";
import { sendPasswordResetEmail } from "@/lib/auth/email-flows";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/auth/forgot-password — email a reset link.
// Always responds 200 so it can't be used to probe which emails exist.
export async function POST(req: Request) {
  try {
    const limit = rateLimit(`forgot:${clientIp(req)}`, RATE_LIMITS.register);
    if (!limit.ok)
      return tooManyRequests(limit.retryAfter, "Too many reset requests");

    const { email } = await req.json();
    if (!email?.trim()) return badRequest("email is required");

    const user = await db.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    });
    if (user) await sendPasswordResetEmail(user.id, user.email);

    return ok({ sent: true });
  } catch (err) {
    return handleError("POST /api/auth/forgot-password", err);
  }
}
