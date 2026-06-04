import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  unauthorized,
  tooManyRequests,
  handleError,
} from "@/lib/api";
import { verifySecret } from "@/lib/crypto";
import { createSession } from "@/lib/auth/session";
import { serializeUser } from "@/lib/serialize";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// POST /api/auth/login — verify credentials and start a session.
export async function POST(req: Request) {
  try {
    // Throttle login attempts per client to slow credential-stuffing.
    const limit = rateLimit(`login:${clientIp(req)}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.ok)
      return tooManyRequests(limit.retryAfter, "Too many login attempts");

    const { email, password } = await req.json();
    if (!email?.trim() || !password)
      return badRequest("email and password are required");

    const user = await db.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
    });

    // Same response whether the email is unknown or the password is wrong.
    if (
      !user ||
      !verifySecret(String(password), user.passwordHash, user.passwordSalt)
    ) {
      return unauthorized("Invalid email or password");
    }

    await createSession(user.id);
    return ok(serializeUser(user));
  } catch (err) {
    return handleError("POST /api/auth/login", err);
  }
}
