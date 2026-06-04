import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  requireMembership,
  unauthorized,
  handleError,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeInvitation } from "@/lib/serialize";
import type { WorkspaceRole } from "@/types";

const VALID_ROLES: WorkspaceRole[] = ["admin", "member", "viewer"];

// GET /api/invitations?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can view invitations");

    const invitations = await db.invitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return ok(invitations.map(serializeInvitation));
  } catch (err) {
    return handleError("GET /api/invitations", err);
  }
}

// POST /api/invitations — invite a user by email (admin/owner only).
// MVP: stores the invitation; email sending can be added later.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { workspaceId, email, role: invitedRole } = await req.json();
    if (!workspaceId || !email?.trim())
      return badRequest("workspaceId and email are required");

    const role = await requireMembership(user.id, workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can invite users");

    const normalizedRole: WorkspaceRole = VALID_ROLES.includes(invitedRole)
      ? invitedRole
      : "member";

    const invitation = await db.invitation.create({
      data: {
        workspaceId,
        email: email.trim().toLowerCase(),
        role: normalizedRole,
        status: "pending",
      },
    });
    return ok(serializeInvitation(invitation), { status: 201 });
  } catch (err) {
    return handleError("POST /api/invitations", err);
  }
}
