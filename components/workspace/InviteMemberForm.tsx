"use client";

import { useState } from "react";
import { ASSIGNABLE_ROLES } from "@/lib/roles";

// InviteMemberForm — invites a user by email + role.
//
// POSTs to /api/invitations. Email delivery is deferred, so a successful invite
// simply creates a pending DB record the invitee can later accept.

export function InviteMemberForm({
  workspaceId,
  canInviteAdmin,
  onInvited,
}: {
  workspaceId: string;
  canInviteAdmin: boolean;
  onInvited?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const roles = ASSIGNABLE_ROLES.filter(
    (r) => r !== "admin" || canInviteAdmin
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, email, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send invitation");
      }
      setEmail("");
      setRole("member");
      setNotice("Invitation created. It is pending until accepted.");
      onInvited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">Invite a member</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Invite a teammate by email. Email delivery is coming later — for now the
        invite is stored and can be accepted from their dashboard.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          required
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Invite role"
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm capitalize outline-none focus:border-neutral-500"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Inviting…" : "Invite"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-400">{notice}</p>}
    </form>
  );
}
