import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
  requireMembership,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeInvitation } from "@/lib/serialize";
import type { InvitationStatus } from "@/types";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: InvitationStatus[] = ["pending", "accepted", "rejected"];

// PATCH /api/invitations/[id] — update invitation status (accept / reject).
// Accepting also creates the workspace membership for the invited email if a
// matching user exists.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const invitation = await db.invitation.findUnique({ where: { id } });
    if (!invitation) return notFound("Invitation not found");

    const { status } = await req.json();
    if (!VALID_STATUSES.includes(status))
      return badRequest("status must be pending, accepted, or rejected");

    // Either an admin/owner of the workspace, or the invited user themselves,
    // may change the invitation status.
    const role = await requireMembership(user.id, invitation.workspaceId);
    const isInvitee =
      user.email.toLowerCase() === invitation.email.toLowerCase();
    if (!canManageWorkspace(role) && !isInvitee)
      return forbidden("You cannot modify this invitation");

    const updated = await db.invitation.update({
      where: { id },
      data: { status },
    });

    // On acceptance, add the invited user to the workspace if we can resolve
    // them by email (MVP: no email sending, but membership still works).
    if (status === "accepted") {
      const invitee = await db.user.findUnique({
        where: { email: invitation.email },
      });
      if (invitee) {
        await db.workspaceMember.upsert({
          where: {
            userId_workspaceId: {
              userId: invitee.id,
              workspaceId: invitation.workspaceId,
            },
          },
          update: {},
          create: {
            userId: invitee.id,
            workspaceId: invitation.workspaceId,
            role: invitation.role,
          },
        });
      }
    }

    return ok(serializeInvitation(updated));
  } catch (err) {
    console.error("[PATCH /api/invitations/:id]", err);
    return serverError();
  }
}

// DELETE /api/invitations/[id] — revoke an invitation (admin/owner only)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const invitation = await db.invitation.findUnique({ where: { id } });
    if (!invitation) return notFound("Invitation not found");

    const role = await requireMembership(user.id, invitation.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can revoke invitations");

    await db.invitation.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/invitations/:id]", err);
    return serverError();
  }
}
