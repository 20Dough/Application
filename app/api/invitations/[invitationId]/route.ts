import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageMembers,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse, normalizeEmail } from "@/lib/api";

type RouteContext = { params: Promise<{ invitationId: string }> };

// PATCH /api/invitations/[invitationId]
// Body: { action: "accept" | "reject" }
// The current user accepts or rejects an invitation addressed to their email.
// Accepting creates the WorkspaceMember record with the invited role.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { invitationId } = await params;

    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "action must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // The invitation must be addressed to the current user.
    if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
      throw new ForbiddenError("This invitation is not addressed to you");
    }
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `This invitation has already been ${invitation.status}` },
        { status: 409 }
      );
    }

    if (action === "reject") {
      const updated = await db.invitation.update({
        where: { id: invitationId },
        data: { status: "rejected" },
      });
      return NextResponse.json({ invitation: updated });
    }

    // Accept: create the membership (idempotently) and mark the invite accepted.
    await db.$transaction([
      db.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: invitation.workspaceId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      }),
      db.invitation.update({
        where: { id: invitationId },
        data: { status: "accepted" },
      }),
    ]);

    return NextResponse.json({
      invitation: { ...invitation, status: "accepted" },
      workspaceId: invitation.workspaceId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/invitations/[invitationId]
// Revokes a pending invitation. Owner/admin of the target workspace only.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { invitationId } = await params;

    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    const membership = await requireWorkspaceMember(
      user.id,
      invitation.workspaceId
    );
    if (!canManageMembers(membership.role)) {
      throw new ForbiddenError(
        "Only owners and admins can revoke invitations"
      );
    }

    await db.invitation.delete({ where: { id: invitationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
