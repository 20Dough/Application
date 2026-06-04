import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  forbidden,
  notFound,
  serverError,
  requireMembership,
  unauthorized,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeAgent } from "@/lib/serialize";

type Params = { params: Promise<{ agentId: string }> };

// PATCH /api/agents/[agentId] — update agent config (admin/owner only)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { agentId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) return notFound("Agent not found");

    const role = await requireMembership(user.id, agent.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage agents");

    const body = await req.json();
    const {
      displayName,
      provider,
      model,
      role: agentRole,
      systemPrompt,
      isActive,
    } = body;
    const updated = await db.agent.update({
      where: { id: agentId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(provider !== undefined ? { provider } : {}),
        ...(model !== undefined ? { model } : {}),
        ...(agentRole !== undefined ? { role: agentRole } : {}),
        ...(systemPrompt !== undefined ? { systemPrompt } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
    return ok(serializeAgent(updated));
  } catch (err) {
    console.error("[PATCH /api/agents/:id]", err);
    return serverError();
  }
}

// DELETE /api/agents/[agentId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { agentId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) return notFound("Agent not found");

    const role = await requireMembership(user.id, agent.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage agents");

    await db.agent.delete({ where: { id: agentId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/agents/:id]", err);
    return serverError();
  }
}
