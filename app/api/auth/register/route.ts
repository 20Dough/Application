import { db } from "@/lib/db";
import { ok, badRequest, serverError } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { serializeUser } from "@/lib/serialize";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// POST /api/auth/register — create an account and sign in.
// Body: { username, password, name }
export async function POST(req: Request) {
  try {
    const { username, password, name } = await req.json();

    if (!username || !USERNAME_RE.test(username))
      return badRequest(
        "Username must be 3–20 chars (letters, numbers, underscore)",
      );
    if (!password || String(password).length < 6)
      return badRequest("Password must be at least 6 characters");
    if (!name?.trim()) return badRequest("Name is required");

    const handle = String(username).toLowerCase();
    const existing = await db.user.findUnique({ where: { username: handle } });
    if (existing) return badRequest("Username is already taken");

    const user = await db.user.create({
      data: {
        username: handle,
        passwordHash: await hashPassword(String(password)),
        name: String(name).trim(),
      },
    });

    await createSession(user.id);
    return ok(serializeUser(user), { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return serverError();
  }
}
