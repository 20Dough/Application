import { describe, it, expect } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { db } from "@/lib/db";
import type { AuthTokenType } from "@/lib/auth/tokens";
import { createUser, jsonRequest, readJson } from "@/test/factories";

const post = (body: unknown) =>
  jsonRequest("http://t", { method: "POST", body });

async function tokenFor(userId: string, type: AuthTokenType) {
  const row = await db.authToken.findFirst({ where: { userId, type } });
  return row?.token;
}

describe("email verification", () => {
  it("registers unverified, then verifies via a single-use token", async () => {
    const res = await register(
      post({ email: "v@test.dev", name: "V", password: "secret123" }),
    );
    expect(res.status).toBe(201);

    const user = await db.user.findUniqueOrThrow({
      where: { email: "v@test.dev" },
    });
    expect(user.emailVerified).toBeNull();

    const token = await tokenFor(user.id, "verify_email");
    expect(token).toBeTruthy();

    const verified = await verifyEmail(post({ token }));
    expect(verified.status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.emailVerified).not.toBeNull();

    // Single-use: the same token can't be reused.
    const again = await verifyEmail(post({ token }));
    expect(again.status).toBe(400);
  });

  it("rejects an invalid verification token", async () => {
    expect((await verifyEmail(post({ token: "nope" }))).status).toBe(400);
  });
});

describe("password reset", () => {
  it("issues a reset token for a known email and never leaks unknown ones", async () => {
    await createUser({ email: "r@test.dev", password: "old-pass" });

    const known = await forgot(post({ email: "r@test.dev" }));
    expect(known.status).toBe(200);
    const unknown = await forgot(post({ email: "nobody@test.dev" }));
    expect(unknown.status).toBe(200); // same response → no account probing

    const user = await db.user.findUniqueOrThrow({
      where: { email: "r@test.dev" },
    });
    const token = await tokenFor(user.id, "password_reset");
    expect(token).toBeTruthy();

    const done = await reset(post({ token, password: "new-pass-1" }));
    expect(done.status).toBe(200);

    // The new password works.
    const li = await readJson(
      await login(post({ email: "r@test.dev", password: "new-pass-1" })),
    );
    expect(li.status).toBe(200);
    // Token is single-use.
    expect((await reset(post({ token, password: "another-1" }))).status).toBe(
      400,
    );
  });

  it("rejects a bad token and a too-short password", async () => {
    expect(
      (await reset(post({ token: "x", password: "longenough" }))).status,
    ).toBe(400);
    expect((await reset(post({ token: "x", password: "123" }))).status).toBe(
      400,
    );
  });
});
