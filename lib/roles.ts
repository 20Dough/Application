// Workspace role definitions and pure permission helpers.
//
// This module deliberately has NO database (or other server-only) imports so it
// can be shared between server route handlers and client components without
// pulling Prisma into the browser bundle. Database-backed checks live in
// lib/permissions.ts, which re-exports everything here for server convenience.
//
// Roles (highest → lowest privilege): owner, admin, member, viewer.
//
//   owner   — manage and delete the workspace; manage all members and invites
//   admin   — manage the workspace; invite users; manage members and viewers
//   member  — view the workspace, participate
//   viewer  — view the workspace only (read-only)

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

// Relative privilege of each role. Higher number = more privilege.
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

// All roles, ordered highest → lowest privilege.
export const ALL_ROLES: WorkspaceRole[] = ["owner", "admin", "member", "viewer"];

// Roles that may be assigned through the API. "owner" is intentionally excluded:
// ownership is fixed at creation time and transferring it is out of scope here.
export const ASSIGNABLE_ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

/** Narrows an arbitrary value to a known workspace role. */
export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && (ALL_ROLES as string[]).includes(value);
}

/** True if the value can be assigned to a member or invitation via the API. */
export function isAssignableRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" && (ASSIGNABLE_ROLES as string[]).includes(value)
  );
}

/** Owners and admins can manage (update) a workspace. */
export function canManageWorkspace(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Only the owner can delete a workspace. */
export function canDeleteWorkspace(role: string): boolean {
  return role === "owner";
}

/**
 * Owners and admins can manage members and invitations (invite, change roles,
 * remove). Members and viewers cannot.
 */
export function canManageMembers(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Decides whether an actor with `actorRole` may change the role of, or remove,
 * a member who currently holds `targetRole`.
 *
 * Rules:
 *   - The actor must be able to manage members at all (owner/admin).
 *   - The owner membership is never a valid target (ownership is immutable here).
 *   - Admins cannot manage other admins; only the owner can. This prevents
 *     admins from demoting or removing one another.
 */
export function canManageMember(
  actorRole: string,
  targetRole: string
): boolean {
  if (!canManageMembers(actorRole)) return false;
  // Ownership cannot be modified through member management.
  if (targetRole === "owner") return false;
  // Only the owner may manage admins.
  if (targetRole === "admin" && actorRole !== "owner") return false;
  return true;
}
