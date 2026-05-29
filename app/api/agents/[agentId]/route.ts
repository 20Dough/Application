import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageAgents,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateAgentUpdate } from "@/lib/agents/profile";

type RouteContext = { params: Promise<{ agentId: string }> };

// GET /api/agents/[agentId]
// Returns a single agent's full profile. The current user must be a member of
// the agent's workspace.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { agentId } = await params;

    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, agent.workspaceId);

    return NextResponse.json({ agent, role: membership.role });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/agents/[agentId]
// Updates an agent's profile (display name, provider/model, role, system
// prompt, avatar, active status). Owners/admins only. The handle is immutable.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { agentId } = await params;

    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, agent.workspaceId);
    if (!canManageAgents(membership.role)) {
      throw new ForbiddenError("Only owners and admins can edit agents");
    }

    const body = await request.json().catch(() => null);
    const result = validateAgentUpdate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await db.agent.update({
      where: { id: agentId },
      data: result.data,
    });

    return NextResponse.json({ agent: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/agents/[agentId]
// Removes an agent from the workspace. Owners/admins only. Room memberships
// cascade away via the schema; messages keep their (now nulled) agent link.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { agentId } = await params;

    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, agent.workspaceId);
    if (!canManageAgents(membership.role)) {
      throw new ForbiddenError("Only owners and admins can delete agents");
    }

    await db.agent.delete({ where: { id: agentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
