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
 * Owners and admins can manage the workspace's AI agents (create, edit,
 * activate/deactivate, delete). Members and viewers can view agents but not
 * change them.
 */
export function canManageAgents(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Owners and admins can manage the workspace's rooms (create, edit, delete,
 * add/remove AI agents, set the default agent). Members and viewers can view
 * rooms but not change them.
 */
export function canManageRooms(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Owners, admins, and members can send messages in a room. Viewers are
 * read-only: they can follow the conversation but cannot post.
 */
export function canSendMessages(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/**
 * Owners and admins curate shared memory and project context (create, edit,
 * delete). Members and viewers can read both — memory and project context feed
 * the AI context that every member's messages rely on — but cannot change them.
 *
 * Memory and project context share the same management bar; they are kept as
 * separate helpers so the two can diverge later (e.g. members proposing memory)
 * without touching call sites.
 */
export function canManageMemory(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Owners and admins can manage a workspace's project context. See canManageMemory. */
export function canManageProjectContext(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Owners and admins curate the workspace's knowledge base (add and remove
 * sources, edit their metadata). Members and viewers can read knowledge — it
 * feeds the AI context their own messages rely on — but cannot change it.
 * Mirrors canManageMemory; kept separate so the two can diverge later.
 */
export function canManageKnowledge(role: string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Owners, admins, and members can generate decision summaries from a room's
 * recent messages. Viewers are read-only: they can read decisions but cannot
 * trigger AI generation (which spends provider usage). Mirrors canSendMessages
 * since both are participation actions, but kept separate so they can diverge.
 */
export function canGenerateSummaries(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/**
 * Owners, admins, and members can run multi-agent discussions and turn them into
 * decisions. Viewers are read-only: they can read discussions but cannot trigger
 * AI generation (which spends provider usage). Mirrors canGenerateSummaries —
 * both are participation actions — but kept separate so they can diverge.
 */
export function canRunDiscussions(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
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
