import { describe, it, expect } from "vitest";
import {
  hashPasscode,
  verifyPasscode,
  canAccessRoom,
} from "@/lib/rooms/passcode";

function reqWithPasscode(passcode?: string): Request {
  return new Request("http://t/api/messages", {
    headers: passcode ? { "x-room-passcode": passcode } : {},
  });
}

describe("passcode hashing", () => {
  it("round-trips a passcode", () => {
    const { hash, salt } = hashPasscode("open-sesame");
    expect(verifyPasscode("open-sesame", hash, salt)).toBe(true);
    expect(verifyPasscode("wrong", hash, salt)).toBe(false);
  });
});

describe("canAccessRoom", () => {
  it("always allows an open (unlocked) room", () => {
    const open = { passcodeHash: null, passcodeSalt: null };
    expect(canAccessRoom(open, reqWithPasscode())).toBe(true);
  });

  it("blocks a locked room without the correct header", () => {
    const { hash, salt } = hashPasscode("p");
    const locked = { passcodeHash: hash, passcodeSalt: salt };
    expect(canAccessRoom(locked, reqWithPasscode())).toBe(false);
    expect(canAccessRoom(locked, reqWithPasscode("nope"))).toBe(false);
    expect(canAccessRoom(locked, reqWithPasscode("p"))).toBe(true);
  });
});
