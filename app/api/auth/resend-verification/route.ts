import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  unauthorized,
  badRequest,
  tooManyRequests,
  handleError,
} from "@/lib/api";
import { sendVerificationEmail } from "@/lib/auth/email-flows";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/auth/resend-verification — re-send the verification email to the
// logged-in user (no-op if already verified).
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const limit = rateLimit(`resend:${clientIp(req)}`, RATE_LIMITS.register);
    if (!limit.ok)
      return tooManyRequests(limit.retryAfter, "Please wait before retrying");

    if (user.emailVerified) return badRequest("Email is already verified");

    await sendVerificationEmail(user.id, user.email);
    return ok({ sent: true });
  } catch (err) {
    return handleError("POST /api/auth/resend-verification", err);
  }
}
