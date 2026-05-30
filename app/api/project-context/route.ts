import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageProjectContext,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateProjectContextCreate } from "@/lib/project-context/validation";

// GET /api/project-context?workspaceId=
// Lists a workspace's project context entries (its stable identity and mission).
// Any member may view; project context feeds every agent's system prompt. Also
// returns the caller's role so the UI can gate management controls.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const projectContexts = await db.projectContext.findMany({
      where: { workspaceId },
      // Oldest first — matches the order the context builder reads them in, so
      // the UI and the prompt agree.
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      projectContexts,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/project-context
// Creates a project context entry in a workspace. Owners/admins only.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canManageProjectContext(membership.role)) {
      throw new ForbiddenError(
        "Only owners and admins can manage project context"
      );
    }

    const result = validateProjectContextCreate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const projectContext = await db.projectContext.create({
      data: { ...result.data, workspaceId },
    });

    return NextResponse.json({ projectContext }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
