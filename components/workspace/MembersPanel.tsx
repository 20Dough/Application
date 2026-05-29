"use client";

import { useCallback, useEffect, useState } from "react";
import { canManageMembers } from "@/lib/roles";
import { MemberList, type Member } from "@/components/workspace/MemberList";
import { InviteMemberForm } from "@/components/workspace/InviteMemberForm";
import {
  InvitationList,
  type Invitation,
} from "@/components/workspace/InvitationList";

// MembersPanel — stateful container for workspace member management.
//
// Fetches the member roster (everyone may view) and, for owners/admins, the
// invitation list. Owns all mutating actions (role change, remove, invite,
// revoke) and refreshes after each. The API enforces every permission rule;
// this component mirrors them only to shape the UI.

export function MembersPanel({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("viewer");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = canManageMembers(currentUserRole);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Failed to load members");
    }
    const data = await res.json();
    setMembers(data.members ?? []);
    setCurrentUserRole(data.role ?? "viewer");
    setCurrentUserId(data.currentUserId ?? "");
    return data.role as string;
  }, [workspaceId]);

  const loadInvitations = useCallback(async () => {
    const res = await fetch(`/api/invitations?workspaceId=${workspaceId}`);
    if (!res.ok) return; // Non-managers get 403; simply show no invitations.
    const data = await res.json();
    setInvitations(data.invitations ?? []);
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    try {
      const role = await loadMembers();
      if (canManageMembers(role)) {
        await loadInvitations();
      } else {
        setInvitations([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [loadMembers, loadInvitations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runAction(id: string, fn: () => Promise<Response>) {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Action failed");
      }
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function handleChangeRole(member: Member, role: string) {
    if (role === member.role) return;
    runAction(member.id, () =>
      fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
    );
  }

  function handleRemove(member: Member) {
    const self = member.userId === currentUserId;
    const label = self ? "leave this workspace" : `remove ${member.user.email}`;
    if (!confirm(`Are you sure you want to ${label}?`)) return;
    runAction(member.id, () =>
      fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
        method: "DELETE",
      })
    );
  }

  function handleRevoke(invitation: Invitation) {
    runAction(invitation.id, () =>
      fetch(`/api/invitations/${invitation.id}`, { method: "DELETE" })
    );
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading members…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {actionError && (
        <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Members ({members.length})
        </h2>
        <MemberList
          members={members}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          busyId={busyId}
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
        />
      </section>

      {canManage && (
        <>
          <section>
            <InviteMemberForm
              workspaceId={workspaceId}
              canInviteAdmin={currentUserRole === "owner"}
              onInvited={refresh}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Invitations
            </h2>
            <InvitationList
              invitations={invitations}
              busyId={busyId}
              onRevoke={handleRevoke}
            />
          </section>
        </>
      )}
    </div>
  );
}
