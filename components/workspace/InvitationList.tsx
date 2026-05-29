"use client";

// InvitationList — pending/processed invitations for a workspace, shown to
// owners and admins. Pending invitations can be revoked.

export type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-300",
  accepted: "text-emerald-400",
  rejected: "text-neutral-500",
};

export function InvitationList({
  invitations,
  busyId,
  onRevoke,
}: {
  invitations: Invitation[];
  busyId: string | null;
  onRevoke: (invitation: Invitation) => void;
}) {
  if (invitations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-500">
        No invitations yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
      {invitations.map((inv) => (
        <li
          key={inv.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-neutral-200">{inv.email}</p>
            <p className="text-xs text-neutral-500">
              <span className="capitalize">{inv.role}</span> ·{" "}
              <span
                className={`capitalize ${
                  STATUS_STYLE[inv.status] ?? "text-neutral-500"
                }`}
              >
                {inv.status}
              </span>
            </p>
          </div>
          {inv.status === "pending" && (
            <button
              type="button"
              onClick={() => onRevoke(inv)}
              disabled={busyId === inv.id}
              className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-red-700/60 hover:text-red-300 disabled:opacity-50"
            >
              Revoke
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
