import { db } from "@/lib/db";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api";
import { verifySecret } from "@/lib/crypto";
import { createSession } from "@/lib/auth/session";
import { serializeUser } from "@/lib/serialize";

// POST /api/auth/login — verify credentials and start a session.
export async function POST(req: Request) {
  try {
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
    console.error("[POST /api/auth/login]", err);
    return serverError();
  }
}
