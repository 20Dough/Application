import { db } from "@/lib/db";
import type { WorkspaceMember } from "@prisma/client";

// Database-backed workspace permission helpers.
//
// Pure, db-free role logic (role constants, rank, canManage* checks) lives in
// lib/roles.ts so it can also be used in client components. This module adds the
// checks that need the database, and re-exports the pure helpers so existing
// server-side imports from "@/lib/permissions" keep working.

export * from "@/lib/roles";

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

/** Thrown when an authenticated user lacks permission for an action. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}
