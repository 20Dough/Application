import { db } from "@/lib/db";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { serializeUser } from "@/lib/serialize";

// POST /api/auth/login — verify credentials and start a session.
// Body: { username, password }
export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password)
      return badRequest("Username and password are required");

    const user = await db.user.findUnique({
      where: { username: String(username).toLowerCase() },
    });
    // Same response whether the user is missing or the password is wrong, to
    // avoid leaking which usernames exist.
    if (!user || !(await verifyPassword(String(password), user.passwordHash)))
      return unauthorized("Invalid username or password");

    await createSession(user.id);
    return ok(serializeUser(user));
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return serverError();
  }
}
