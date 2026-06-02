"use client";

import { useEffect, useState } from "react";
import type { Invitation, User, WorkspaceMember, WorkspaceRole } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { initials } from "@/lib/utils";
import {
  fetchInvitations,
  inviteMember,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from "@/lib/client-api";

interface ManageTeamProps {
  workspaceId: string;
  currentUser: User;
  members: WorkspaceMember[];
  canManage: boolean;
  onClose: () => void;
  onMembersChange: (members: WorkspaceMember[]) => void;
}

const ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

export function ManageTeam({
  workspaceId,
  currentUser,
  members,
  canManage,
  onClose,
  onMembersChange,
}: ManageTeamProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    fetchInvitations(workspaceId)
      .then(setInvitations)
      .catch(() => {});
  }, [workspaceId, canManage]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const inv = await inviteMember(workspaceId, email.trim(), inviteRole);
      setInvitations((prev) => [inv, ...prev]);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(member: WorkspaceMember, role: string) {
    try {
      const updated = await updateMemberRole(member.id, role);
      onMembersChange(
        members.map((m) =>
          m.id === member.id ? { ...m, role: updated.role } : m,
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRemoveMember(member: WorkspaceMember) {
    try {
      await removeMember(member.id);
      onMembersChange(members.filter((m) => m.id !== member.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRevoke(inv: Invitation) {
    try {
      await revokeInvitation(inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal title="Team members" onClose={onClose}>
      {error && (
        <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Members */}
      <ul className="space-y-2">
        {members.map((member) => {
          const isOwner = member.role === "owner";
          const isSelf = member.userId === currentUser.id;
          return (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-md border border-hive-border bg-hive-panel px-3 py-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hive-accent text-[11px] font-bold text-black">
                {initials(member.user?.name ?? "?")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-hive-text">
                  {member.user?.name}
                  {isSelf && (
                    <span className="ml-1 text-xs text-hive-muted">(you)</span>
                  )}
                </p>
                <p className="truncate text-[11px] text-hive-muted">
                  @{member.user?.username}
                </p>
              </div>

              {canManage && !isOwner ? (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member, e.target.value)}
                  className="rounded border border-hive-border bg-hive-surface px-2 py-1 text-xs text-hive-text focus:border-hive-accent focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] uppercase text-hive-muted">
                  {member.role}
                </span>
              )}

              {canManage && !isOwner && !isSelf && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member)}
                  className="rounded px-2 py-1 text-xs text-hive-muted transition hover:text-red-400"
                  title="Remove member"
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Invite + pending invitations (managers only) */}
      {canManage && (
        <div className="mt-5 border-t border-hive-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-hive-muted">
            Invite by email
          </h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="flex-1 rounded-md border border-hive-border bg-hive-panel px-3 py-1.5 text-sm text-hive-text placeholder:text-hive-muted focus:border-hive-accent focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="rounded-md border border-hive-border bg-hive-panel px-2 py-1.5 text-sm text-hive-text focus:border-hive-accent focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="rounded-md bg-hive-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
            >
              Invite
            </button>
          </form>

          {invitations.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-2 rounded-md border border-hive-border bg-hive-panel px-3 py-1.5"
                >
                  <span className="flex-1 truncate text-sm text-hive-text">
                    {inv.email}
                  </span>
                  <span className="text-[10px] uppercase text-hive-muted">
                    {inv.role} · {inv.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv)}
                    className="rounded px-1.5 py-0.5 text-xs text-hive-muted transition hover:text-red-400"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
