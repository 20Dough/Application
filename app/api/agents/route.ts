import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageAgents,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateAgentCreate } from "@/lib/agents/profile";

// GET /api/agents?workspaceId=
// Lists the AI agents in a workspace. Any member may view the roster. Also
// returns the current user's role so the UI can gate management controls.
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

    const agents = await db.agent.findMany({
      where: { workspaceId },
      // Active agents first, then alphabetical by display name.
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    });

    return NextResponse.json({
      agents,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/agents
// Creates a new AI agent in a workspace. Owners/admins only. The agent name is
// unique within a workspace (it anchors @mentions).
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
    if (!canManageAgents(membership.role)) {
      throw new ForbiddenError("Only owners and admins can create agents");
    }

    const result = validateAgentCreate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Enforce the unique handle within the workspace before inserting so we can
    // return a friendly 409 instead of a raw constraint error.
    const clash = await db.agent.findUnique({
      where: {
        workspaceId_name: { workspaceId, name: result.data.name },
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: `An agent named "${result.data.name}" already exists` },
        { status: 409 }
      );
    }

    const agent = await db.agent.create({
      data: { ...result.data, workspaceId },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
