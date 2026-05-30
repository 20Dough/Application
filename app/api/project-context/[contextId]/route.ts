import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageProjectContext,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateProjectContextUpdate } from "@/lib/project-context/validation";

type RouteContext = { params: Promise<{ contextId: string }> };

// GET /api/project-context/[contextId]
// Returns a single project context entry. Caller must be a workspace member.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { contextId } = await params;

    const projectContext = await db.projectContext.findUnique({
      where: { id: contextId },
    });
    if (!projectContext) {
      return NextResponse.json(
        { error: "Project context not found" },
        { status: 404 }
      );
    }

    const membership = await requireWorkspaceMember(
      user.id,
      projectContext.workspaceId
    );

    return NextResponse.json({ projectContext, role: membership.role });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/project-context/[contextId]
// Updates a project context entry (title, content). Owners/admins only.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { contextId } = await params;

    const projectContext = await db.projectContext.findUnique({
      where: { id: contextId },
    });
    if (!projectContext) {
      return NextResponse.json(
        { error: "Project context not found" },
        { status: 404 }
      );
    }

    const membership = await requireWorkspaceMember(
      user.id,
      projectContext.workspaceId
    );
    if (!canManageProjectContext(membership.role)) {
      throw new ForbiddenError(
        "Only owners and admins can manage project context"
      );
    }

    const body = await request.json().catch(() => null);
    const result = validateProjectContextUpdate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await db.projectContext.update({
      where: { id: contextId },
      data: result.data,
    });

    return NextResponse.json({ projectContext: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/project-context/[contextId]
// Removes a project context entry. Owners/admins only.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { contextId } = await params;

    const projectContext = await db.projectContext.findUnique({
      where: { id: contextId },
    });
    if (!projectContext) {
      return NextResponse.json(
        { error: "Project context not found" },
        { status: 404 }
      );
    }

    const membership = await requireWorkspaceMember(
      user.id,
      projectContext.workspaceId
    );
    if (!canManageProjectContext(membership.role)) {
      throw new ForbiddenError(
        "Only owners and admins can manage project context"
      );
    }

    await db.projectContext.delete({ where: { id: contextId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
