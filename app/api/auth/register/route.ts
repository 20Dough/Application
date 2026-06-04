import { db } from "@/lib/db";
import { ok, badRequest, tooManyRequests, handleError } from "@/lib/api";
import { hashSecret } from "@/lib/crypto";
import { createSession } from "@/lib/auth/session";
import { serializeUser } from "@/lib/serialize";
import { rateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";

const MIN_PASSWORD_LENGTH = 6;

// POST /api/auth/register — create an account and start a session.
export async function POST(req: Request) {
  try {
    const limit = rateLimit(`register:${clientIp(req)}`, RATE_LIMITS.register);
    if (!limit.ok)
      return tooManyRequests(limit.retryAfter, "Too many sign-up attempts");

    const { email, name, password } = await req.json();
    if (!email?.trim() || !name?.trim() || !password)
      return badRequest("email, name and password are required");
    if (String(password).length < MIN_PASSWORD_LENGTH)
      return badRequest(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) return badRequest("That email is already registered");

    const { hash, salt } = hashSecret(String(password));
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: String(name).trim(),
        passwordHash: hash,
        passwordSalt: salt,
      },
    });

    await createSession(user.id);
    return ok(serializeUser(user), { status: 201 });
  } catch (err) {
    return handleError("POST /api/auth/register", err);
  }
}
