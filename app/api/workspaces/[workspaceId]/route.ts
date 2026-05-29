import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageWorkspace,
  canDeleteWorkspace,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";

type RouteContext = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]
// Returns workspace details. The current user must be a member.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      workspace: { ...workspace, role: membership.role },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/workspaces/[workspaceId]
// Updates name/description. Allowed for owner and admin.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canManageWorkspace(membership.role)) {
      throw new ForbiddenError("Only owners and admins can update this workspace");
    }

    const body = await request.json().catch(() => null);

    const data: { name?: string; description?: string | null } = {};
    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Workspace name cannot be empty" },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if (typeof body?.description === "string") {
      data.description = body.description.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data,
    });

    return NextResponse.json({
      workspace: { ...workspace, role: membership.role },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/workspaces/[workspaceId]
// Deletes the workspace. Owner only. Cascades to members/rooms/etc. via schema.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId } = await params;

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canDeleteWorkspace(membership.role)) {
      throw new ForbiddenError("Only the owner can delete this workspace");
    }

    await db.workspace.delete({ where: { id: workspaceId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
