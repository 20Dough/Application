import { describe, it, expect } from "vitest";
import {
  createSession,
  getSessionUser,
  destroySession,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createUser } from "@/test/factories";

describe("sessions", () => {
  it("creates a session and resolves the user from the cookie", async () => {
    const user = await createUser();
    await createSession(user.id);

    expect(await db.session.count()).toBe(1);
    const resolved = await getSessionUser();
    expect(resolved?.id).toBe(user.id);
  });

  it("treats an expired session as no session and cleans it up", async () => {
    const user = await createUser();
    await createSession(user.id);
    await db.session.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getSessionUser()).toBeNull();
    expect(await db.session.count()).toBe(0); // expired row removed
  });

  it("returns null when there is no cookie", async () => {
    expect(await getSessionUser()).toBeNull();
  });

  it("destroySession removes the row and clears the cookie", async () => {
    const user = await createUser();
    await createSession(user.id);
    await destroySession();

    expect(await db.session.count()).toBe(0);
    expect(await getSessionUser()).toBeNull();
  });
});
