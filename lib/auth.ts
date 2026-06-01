// Placeholder auth for the MVP.
//
// Returns a fake "current user" so the app works locally without Clerk. The
// abstraction is intentionally thin so a real auth provider can replace the
// body of getCurrentUser() later without touching call sites.

import { db } from "@/lib/db";

export async function getCurrentUser() {
  const email = process.env.DEV_USER_EMAIL ?? "van@hivemind.dev";
  const name = process.env.DEV_USER_NAME ?? "Van";

  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name },
  });
}
