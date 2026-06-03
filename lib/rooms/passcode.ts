// Per-room passcode hashing. Uses Node's scrypt with a per-room random salt so
// passcodes are never stored in plain text. Server-side only.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export interface PasscodeHash {
  hash: string;
  salt: string;
}

/** Hash a passcode with a fresh random salt. */
export function hashPasscode(passcode: string): PasscodeHash {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, 64).toString("hex");
  return { hash, salt };
}

/** Constant-time check of a passcode against a stored hash + salt. */
export function verifyPasscode(
  passcode: string,
  hash: string | null,
  salt: string | null,
): boolean {
  if (!hash || !salt) return false;
  const candidate = scryptSync(passcode, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Minimal shape needed to gate access to a room. */
export interface LockableRoom {
  passcodeHash: string | null;
  passcodeSalt: string | null;
}

/**
 * Whether a request may access a locked room. Open rooms are always allowed;
 * locked rooms require a matching passcode in the `x-room-passcode` header.
 * Used by every route that reads or writes room data so the gate stays uniform.
 */
export function canAccessRoom(room: LockableRoom, req: Request): boolean {
  if (!room.passcodeHash) return true;
  const provided = req.headers.get("x-room-passcode");
  return verifyPasscode(provided ?? "", room.passcodeHash, room.passcodeSalt);
}
