import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageMembers,
  isAssignableRole,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse, isValidEmail, normalizeEmail } from "@/lib/api";

// GET /api/invitations
//   ?workspaceId=…  → pending/processed invitations for that workspace
//                     (owner/admin only). Used by the member management UI.
//   (no param)      → the current user's own pending invitations, by email.
//                     Used by the dashboard so a user can accept/reject.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");

    if (workspaceId) {
      const membership = await requireWorkspaceMember(user.id, workspaceId);
      if (!canManageMembers(membership.role)) {
        throw new ForbiddenError(
          "Only owners and admins can view invitations"
        );
      }

      const invitations = await db.invitation.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ invitations });
    }

    // No workspace specified → invitations addressed to this user.
    const invitations = await db.invitation.findMany({
      where: { email: normalizeEmail(user.email), status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        workspace: { select: { id: true, name: true, description: true } },
      },
    });
    return NextResponse.json({ invitations });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/invitations
// Creates a pending invitation (email + role). Owner/admin only.
// Email delivery is deferred; the invitation simply lives in the DB until the
// invitee accepts or rejects it.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId : "";
    const role = body?.role ?? "member";

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(body?.email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }
    if (!isAssignableRole(role)) {
      return NextResponse.json(
        { error: "Role must be admin, member, or viewer" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canManageMembers(membership.role)) {
      throw new ForbiddenError("Only owners and admins can invite members");
    }
    // Only the owner may invite someone directly as an admin.
    if (role === "admin" && membership.role !== "owner") {
      throw new ForbiddenError("Only the owner can invite admins");
    }

    const email = normalizeEmail(body.email);

    // If the email already belongs to a member, there is nothing to invite.
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: existingUser.id, workspaceId },
        },
      });
      if (alreadyMember) {
        return NextResponse.json(
          { error: "That person is already a member of this workspace" },
          { status: 409 }
        );
      }
    }

    // Avoid stacking duplicate pending invitations for the same email.
    const existingInvite = await db.invitation.findFirst({
      where: { workspaceId, email, status: "pending" },
    });
    if (existingInvite) {
      return NextResponse.json(
        { error: "There is already a pending invitation for that email" },
        { status: 409 }
      );
    }

    const invitation = await db.invitation.create({
      data: { workspaceId, email, role, status: "pending" },
    });

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
