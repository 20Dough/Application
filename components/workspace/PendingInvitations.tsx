"use client";

import { useCallback, useEffect, useState } from "react";

// PendingInvitations — shows invitations addressed to the current user and lets
// them accept (joining the workspace) or reject. Accepting refreshes the
// workspace list via the onAccepted callback.

type MyInvitation = {
  id: string;
  role: string;
  workspace: { id: string; name: string; description: string | null };
};

export function PendingInvitations({
  onAccepted,
}: {
  onAccepted?: () => void;
}) {
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations");
      if (!res.ok) return;
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      // Non-fatal: the dashboard still works without this widget.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, action: "accept" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to respond to invitation");
      }
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      if (action === "accept") onAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond");
    } finally {
      setBusyId(null);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/20 p-5">
      <h2 className="font-semibold text-amber-200">Pending invitations</h2>
      <p className="mt-1 text-sm text-neutral-400">
        You&apos;ve been invited to join these workspaces.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <ul className="mt-4 space-y-3">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-4 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-100">
                {inv.workspace.name}
              </p>
              <p className="text-xs text-neutral-500">
                Invited as <span className="capitalize">{inv.role}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => respond(inv.id, "accept")}
                disabled={busyId === inv.id}
                className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => respond(inv.id, "reject")}
                disabled={busyId === inv.id}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-200 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
