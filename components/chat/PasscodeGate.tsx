"use client";

import { useState } from "react";
import type { Room } from "@/types";

interface PasscodeGateProps {
  room: Room;
  error?: string | null;
  onUnlock: (passcode: string) => void;
}

/** Shown in place of the chat when a locked room hasn't been unlocked yet. */
export function PasscodeGate({ room, error, onUnlock }: PasscodeGateProps) {
  const [passcode, setPasscode] = useState("");

  function submit() {
    if (!passcode.trim()) return;
    onUnlock(passcode);
  }

  return (
    <section className="flex h-full flex-1 flex-col items-center justify-center bg-hive-bg p-6">
      <div className="w-full max-w-xs rounded-lg border border-hive-border bg-hive-panel p-5 text-center">
        <div className="mb-2 text-3xl">🔒</div>
        <h2 className="text-sm font-semibold text-hive-text">{room.name}</h2>
        <p className="mb-4 mt-1 text-xs text-hive-muted">
          This room is protected. Enter the passcode to continue.
        </p>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Passcode"
          className="w-full rounded-md border border-hive-border bg-hive-surface px-3 py-2 text-center text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!passcode.trim()}
          className="mt-3 w-full rounded-md bg-hive-accent px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
        >
          Unlock
        </button>
      </div>
    </section>
  );
}
