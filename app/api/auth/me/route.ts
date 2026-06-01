import { ok, unauthorized, serverError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { serializeUser } from "@/lib/serialize";

// GET /api/auth/me — the currently signed-in user, or 401.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return ok(serializeUser(user));
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return serverError();
  }
}
