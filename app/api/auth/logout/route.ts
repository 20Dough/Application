import { ok, handleError } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

// POST /api/auth/logout — end the current session.
export async function POST() {
  try {
    await destroySession();
    return ok({ ok: true });
  } catch (err) {
    return handleError("POST /api/auth/logout", err);
  }
}
