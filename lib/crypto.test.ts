import { describe, it, expect } from "vitest";
import { hashSecret, verifySecret } from "@/lib/crypto";

describe("crypto", () => {
  it("hashes with a random per-secret salt", () => {
    const a = hashSecret("hunter2");
    const b = hashSecret("hunter2");
    expect(a.hash).not.toBe(b.hash); // different salts → different hashes
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).toMatch(/^[0-9a-f]+$/);
  });

  it("verifies a correct secret", () => {
    const { hash, salt } = hashSecret("hunter2");
    expect(verifySecret("hunter2", hash, salt)).toBe(true);
  });

  it("rejects a wrong secret", () => {
    const { hash, salt } = hashSecret("hunter2");
    expect(verifySecret("nope", hash, salt)).toBe(false);
  });

  it("rejects when hash or salt is missing", () => {
    expect(verifySecret("x", null, null)).toBe(false);
    expect(verifySecret("x", "abc", null)).toBe(false);
  });
});
