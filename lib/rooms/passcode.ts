// Per-room passcode hashing + access gating. Built on the shared scrypt helper
// in lib/crypto. Server-side only.

import { hashSecret, verifySecret, type SecretHash } from "@/lib/crypto";

export type PasscodeHash = SecretHash;

/** Hash a passcode with a fresh random salt. */
export function hashPasscode(passcode: string): PasscodeHash {
  return hashSecret(passcode);
}

/** Constant-time check of a passcode against a stored hash + salt. */
export function verifyPasscode(
  passcode: string,
  hash: string | null,
  salt: string | null,
): boolean {
  return verifySecret(passcode, hash, salt);
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
