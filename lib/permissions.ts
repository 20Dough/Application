import { db } from "@/lib/db";
import type { WorkspaceMember } from "@prisma/client";

// Workspace permissions.
//
// Roles (highest → lowest privilege): owner, admin, member, viewer.
//
//   owner   — manage and delete the workspace (full control)
//   admin   — manage the workspace (name/description, future agents/rooms)
//   member  — view the workspace, participate
//   viewer  — view the workspace only
//
// Role checks are intentionally pure functions so they can be reused on both
// the API and (future) UI sides without touching the database.

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/**
 * Returns the membership record linking a user to a workspace, or null if the
 * user is not a member.
 */
export async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember | null> {
  return db.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  });
}

/**
 * Returns the membership record, or throws ForbiddenError if the user is not a
 * member of the workspace. Route handlers translate this into a 403/404.
 */
export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember> {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  if (!membership) {
    throw new ForbiddenError("You are not a member of this workspace");
  }
  return membership;
}

/** Owners and admins can manage (update) a workspace. */
export function canManageWorkspace(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Only the owner can delete a workspace. */
export function canDeleteWorkspace(role: string): boolean {
  return role === "owner";
}

/** Thrown when an authenticated user lacks permission for an action. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}
