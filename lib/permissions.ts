// Role-based permission helpers.
//
// Roles (highest → lowest): owner > admin > member > viewer.

import { db } from "@/lib/db";
import type { WorkspaceRole } from "@/types";

const RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/** Look up a user's role within a workspace, or null if not a member. */
export async function getMemberRole(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const member = await db.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  return (member?.role as WorkspaceRole) ?? null;
}

/** True if `role` meets or exceeds `required`. */
export function roleAtLeast(
  role: WorkspaceRole | null,
  required: WorkspaceRole,
): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[required];
}

/** Viewers can read but never send messages or call AI agents. */
export function canSendMessages(role: WorkspaceRole | null): boolean {
  return roleAtLeast(role, "member");
}

/** Managing agents/memory/context requires admin or owner. */
export function canManageWorkspace(role: WorkspaceRole | null): boolean {
  return roleAtLeast(role, "admin");
}
