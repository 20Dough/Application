"use client";

import { useState } from "react";
import type { User } from "@/types";
import { login, register } from "@/lib/client-api";

interface AuthFormProps {
  onAuthenticated: (user: User) => void;
}

type Mode = "login" | "register";

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await login(username.trim(), password)
          : await register(username.trim(), password, name.trim());
      onAuthenticated(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-hive-bg p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-hive-accent text-2xl">
            🐝
          </div>
          <h1 className="text-xl font-semibold text-hive-text">HiveMind</h1>
          <p className="mt-1 text-sm text-hive-muted">
            Human + AI team workspace
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex rounded-lg border border-hive-border bg-hive-surface p-1">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition " +
                (mode === m
                  ? "bg-hive-panel text-hive-text"
                  : "text-hive-muted hover:text-hive-text")
              }
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <Field
              label="Name (how teammates see you)"
              value={name}
              onChange={setName}
              placeholder="e.g. Alex"
              autoFocus
            />
          )}
          <Field
            label="Username"
            value={username}
            onChange={setUsername}
            placeholder="3–20 letters, numbers, underscore"
            autoComplete="username"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === "register" ? "At least 6 characters" : ""}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-hive-accent px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-hive-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-hive-border bg-hive-surface px-3 py-2 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
      />
    </label>
  );
}
