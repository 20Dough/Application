import { describe, it, expect } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as bootstrap } from "@/app/api/bootstrap/route";
import { db } from "@/lib/db";
import { jsonRequest, readJson, createUser } from "@/test/factories";

describe("auth: register", () => {
  it("creates an account, starts a session, and never leaks password fields", async () => {
    const res = await register(
      jsonRequest("http://t/api/auth/register", {
        method: "POST",
        body: { email: "New@Test.dev", name: "New", password: "secret123" },
      }),
    );
    const body = await readJson(res);

    expect(body.status).toBe(201);
    expect(body.data.email).toBe("new@test.dev"); // normalized to lowercase
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|passwordSalt/);

    // A bootstrap with the session cookie now succeeds.
    const boot = await readJson(await bootstrap());
    expect(boot.status).toBe(200);
    expect(boot.data.currentUser.email).toBe("new@test.dev");
  });

  it("rejects a short password", async () => {
    const res = await register(
      jsonRequest("http://t/api/auth/register", {
        method: "POST",
        body: { email: "a@test.dev", name: "A", password: "123" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    await createUser({ email: "dup@test.dev" });
    const res = await register(
      jsonRequest("http://t/api/auth/register", {
        method: "POST",
        body: { email: "dup@test.dev", name: "Dup", password: "secret123" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("auth: login / logout", () => {
  it("rejects wrong credentials with 401", async () => {
    await createUser({ email: "real@test.dev", password: "correct-horse" });
    const res = await login(
      jsonRequest("http://t/api/auth/login", {
        method: "POST",
        body: { email: "real@test.dev", password: "wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("logs in with correct credentials and persists a session", async () => {
    await createUser({ email: "real@test.dev", password: "correct-horse" });

    const res = await login(
      jsonRequest("http://t/api/auth/login", {
        method: "POST",
        body: { email: "real@test.dev", password: "correct-horse" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await db.session.count()).toBe(1);

    // Session resolves on bootstrap.
    expect((await bootstrap()).status).toBe(200);
  });

  it("logout clears the session so bootstrap is 401 again", async () => {
    const user = await createUser();
    await login(
      jsonRequest("http://t/api/auth/login", {
        method: "POST",
        body: { email: user.email, password: "password" },
      }),
    );
    expect((await bootstrap()).status).toBe(200);

    await logout();
    expect(await db.session.count()).toBe(0);
    expect((await bootstrap()).status).toBe(401);
  });
});

describe("auth: bootstrap gating", () => {
  it("returns 401 when there is no session", async () => {
    expect((await bootstrap()).status).toBe(401);
  });
});
