"use client";

import { ASSIGNABLE_ROLES, canManageMember } from "@/lib/roles";

// MemberList — presentational roster of workspace members.
//
// Role changes and removals are gated client-side for UX (the API enforces the
// same rules authoritatively). Action callbacks are owned by the parent panel.

export type Member = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

const ROLE_BADGE: Record<string, string> = {
  owner: "border-amber-700/60 text-amber-300",
  admin: "border-sky-700/60 text-sky-300",
  member: "border-neutral-700 text-neutral-300",
  viewer: "border-neutral-800 text-neutral-500",
};

export function MemberList({
  members,
  currentUserRole,
  currentUserId,
  busyId,
  onChangeRole,
  onRemove,
}: {
  members: Member[];
  currentUserRole: string;
  currentUserId: string;
  busyId: string | null;
  onChangeRole: (member: Member, role: string) => void;
  onRemove: (member: Member) => void;
}) {
  return (
    <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
      {members.map((member) => {
        const isSelf = member.userId === currentUserId;
        const manageable = canManageMember(currentUserRole, member.role);
        const canChangeRole = manageable && member.role !== "owner";
        const canRemove =
          member.role !== "owner" && (manageable || isSelf);
        const busy = busyId === member.id;

        return (
          <li
            key={member.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-100">
                {member.user.name || member.user.email}
                {isSelf && (
                  <span className="ml-2 text-xs text-neutral-500">(you)</span>
                )}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {member.user.email}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canChangeRole ? (
                <select
                  aria-label={`Role for ${member.user.email}`}
                  value={member.role}
                  disabled={busy}
                  onChange={(e) => onChangeRole(member, e.target.value)}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs capitalize text-neutral-200 outline-none focus:border-neutral-500 disabled:opacity-50"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                    ROLE_BADGE[member.role] ?? ROLE_BADGE.member
                  }`}
                >
                  {member.role}
                </span>
              )}

              {canRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(member)}
                  disabled={busy}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-red-700/60 hover:text-red-300 disabled:opacity-50"
                >
                  {isSelf ? "Leave" : "Remove"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
