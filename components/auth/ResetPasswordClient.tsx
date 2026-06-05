"use client";

import { useState } from "react";
import { resetPassword } from "@/lib/client-api";
import { AuthCard } from "@/components/auth/AuthCard";

const inputClass =
  "w-full rounded-md border border-hive-border bg-hive-surface px-3 py-2 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset password">
        <p className="text-sm text-red-400">This link is missing its token.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" showHome={done}>
      {done ? (
        <p className="text-sm text-hive-text">
          ✅ Your password has been reset. You can now sign in.
        </p>
      ) : (
        <div className="space-y-2.5 text-left">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="New password"
            autoComplete="new-password"
            className={inputClass}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || !password}
            className="w-full rounded-md bg-hive-accent px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Resetting…" : "Set new password"}
          </button>
        </div>
      )}
    </AuthCard>
  );
}
