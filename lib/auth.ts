// Current-user resolution for the app.
//
// Backed by real session cookies (see lib/auth/session.ts). Returns null when
// no valid session exists; route handlers turn that into a 401. Wrapped in
// React's `cache` so multiple calls within one request hit the DB once.

import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";

export const getCurrentUser = cache(async () => getSessionUser());
