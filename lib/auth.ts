// Placeholder auth for the MVP.
//
// Returns a fake "current user" so the app works locally without Clerk. The
// abstraction is intentionally thin so a real auth provider can replace the
// body of getCurrentUser() later without touching call sites.
//
// Wrapped in React's `cache` so multiple calls within the same server request
// (e.g. several helpers each resolving the current user) hit the database once.

import { cache } from "react";
import { db } from "@/lib/db";

export const getCurrentUser = cache(async () => {
  const email = process.env.DEV_USER_EMAIL ?? "van@hivemind.dev";
  const name = process.env.DEV_USER_NAME ?? "Van";

  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name },
  });
});
