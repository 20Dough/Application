import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageMember,
  isAssignableRole,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";

type RouteContext = {
  params: Promise<{ workspaceId: string; memberId: string }>;
};

// PATCH /api/workspaces/[workspaceId]/members/[memberId]
// Changes a member's role. Owners/admins only, subject to canManageMember.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId, memberId } = await params;

    const actor = await requireWorkspaceMember(user.id, workspaceId);

    const body = await request.json().catch(() => null);
    const role = body?.role;
    if (!isAssignableRole(role)) {
      return NextResponse.json(
        { error: "A valid role (admin, member, or viewer) is required" },
        { status: 400 }
      );
    }

    const target = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!target || target.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Permission: the actor must be allowed to manage this member's current role.
    if (!canManageMember(actor.role, target.role)) {
      throw new ForbiddenError(
        "You do not have permission to change this member's role"
      );
    }
    // And, when promoting to admin, only the owner may grant that role.
    if (role === "admin" && actor.role !== "owner") {
      throw new ForbiddenError("Only the owner can grant the admin role");
    }

    const updated = await db.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/workspaces/[workspaceId]/members/[memberId]
// Removes a member from the workspace.
//   - Owners/admins may remove members (subject to canManageMember).
//   - Any non-owner may remove themselves (leave the workspace).
//   - The owner cannot be removed; delete the workspace instead.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId, memberId } = await params;

    const actor = await requireWorkspaceMember(user.id, workspaceId);

    const target = await db.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!target || target.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === "owner") {
      throw new ForbiddenError(
        "The owner cannot be removed. Delete the workspace instead."
      );
    }

    const isSelf = target.userId === user.id;
    if (!isSelf && !canManageMember(actor.role, target.role)) {
      throw new ForbiddenError(
        "You do not have permission to remove this member"
      );
    }

    await db.workspaceMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
