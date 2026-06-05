"use client";

import { useEffect, useState } from "react";
import { verifyEmail } from "@/lib/client-api";
import { AuthCard } from "@/components/auth/AuthCard";

export function VerifyEmailClient({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This link is missing its token.");
      return;
    }
    verifyEmail(token)
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMessage((e as Error).message);
      });
  }, [token]);

  return (
    <AuthCard title="Email verification">
      {state === "loading" && (
        <p className="text-sm text-hive-muted">Verifying your email…</p>
      )}
      {state === "ok" && (
        <p className="text-sm text-hive-text">
          ✅ Your email is verified. You can close this tab or head back to
          HiveMind.
        </p>
      )}
      {state === "error" && <p className="text-sm text-red-400">{message}</p>}
    </AuthCard>
  );
}
