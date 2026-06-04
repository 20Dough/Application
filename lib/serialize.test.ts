import { describe, it, expect } from "vitest";
import {
  serializeUser,
  serializeRoom,
  serializeMessage,
} from "@/lib/serialize";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("serializeUser", () => {
  it("never forwards password fields to the client", () => {
    const out = serializeUser({
      id: "u1",
      email: "a@b.dev",
      name: "A",
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      passwordHash: "SECRET_HASH",
      passwordSalt: "SECRET_SALT",
    });
    expect(JSON.stringify(out)).not.toMatch(/SECRET_HASH|SECRET_SALT/);
    expect(out).not.toHaveProperty("passwordHash");
    expect(out.email).toBe("a@b.dev");
  });
});

describe("serializeRoom", () => {
  const base = {
    id: "r1",
    workspaceId: "w1",
    name: "General",
    description: null,
    defaultAgentId: null,
    createdById: "u1",
    createdAt: now,
    updatedAt: now,
  };

  it("exposes isLocked but never the passcode hash", () => {
    const locked = serializeRoom({ ...base, passcodeHash: "HASH" });
    expect(locked.isLocked).toBe(true);
    expect(JSON.stringify(locked)).not.toMatch(/HASH/);

    const open = serializeRoom({ ...base, passcodeHash: null });
    expect(open.isLocked).toBe(false);
  });
});

describe("serializeMessage", () => {
  it("parses the JSON metadata column into an object", () => {
    const out = serializeMessage({
      id: "m1",
      roomId: "r1",
      senderType: "agent",
      userId: null,
      agentId: "a1",
      content: "hi",
      metadata: JSON.stringify({ model: "gpt-4o", outputTokens: 5 }),
      createdAt: now,
      agent: { displayName: "ARi", role: "Reviewer" },
    });
    expect(out.metadata?.model).toBe("gpt-4o");
    expect(out.senderName).toBe("ARi");
  });

  it("tolerates null metadata", () => {
    const out = serializeMessage({
      id: "m2",
      roomId: "r1",
      senderType: "system",
      userId: null,
      agentId: null,
      content: "sys",
      metadata: null,
      createdAt: now,
    });
    expect(out.metadata).toBeNull();
  });
});
