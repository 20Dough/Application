// Shared secret hashing (passwords, room passcodes). Uses Node's scrypt with a
// per-secret random salt so secrets are never stored in plain text, and a
// constant-time comparison on verify. Server-side only.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export interface SecretHash {
  hash: string;
  salt: string;
}

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Hash a secret with a fresh random salt. */
export function hashSecret(secret: string): SecretHash {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(secret, salt, KEY_LENGTH).toString("hex");
  return { hash, salt };
}

/** Constant-time check of a secret against a stored hash + salt. */
export function verifySecret(
  secret: string,
  hash: string | null,
  salt: string | null,
): boolean {
  if (!hash || !salt) return false;
  const candidate = scryptSync(secret, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
