import { ok, serverError } from "@/lib/api";
import { destroySession } from "@/lib/session";

// POST /api/auth/logout — end the current session.
export async function POST() {
  try {
    await destroySession();
    return ok({ loggedOut: true });
  } catch (err) {
    console.error("[POST /api/auth/logout]", err);
    return serverError();
  }
}
