"use client";

import { useState } from "react";
import { login, register } from "@/lib/client-api";

interface AuthScreenProps {
  /** Called after a successful login or registration. */
  onAuthed: () => void;
}

type Mode = "login" | "register";

export function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(email.trim(), name.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      onAuthed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    email.trim() && password && (mode === "login" || name.trim()) && !busy;

  return (
    <div className="flex h-screen items-center justify-center bg-hive-bg p-6">
      <div className="w-full max-w-sm rounded-lg border border-hive-border bg-hive-panel p-6">
        <div className="mb-5 text-center">
          <div className="mb-1 text-3xl">🐝</div>
          <h1 className="text-lg font-semibold text-hive-text">HiveMind</h1>
          <p className="text-xs text-hive-muted">
            Human + AI team collaboration
          </p>
        </div>

        {/* Mode tabs */}
        <div className="mb-4 flex rounded-md border border-hive-border p-0.5">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={
                "flex-1 rounded px-3 py-1.5 text-xs font-medium capitalize transition " +
                (mode === m
                  ? "bg-hive-accent text-black"
                  : "text-hive-muted hover:text-hive-text")
              }
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {mode === "register" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-md border border-hive-border bg-hive-surface px-3 py-2 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-md border border-hive-border bg-hive-surface px-3 py-2 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
            placeholder="Password"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            className="w-full rounded-md border border-hive-border bg-hive-surface px-3 py-2 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full rounded-md bg-hive-accent px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
