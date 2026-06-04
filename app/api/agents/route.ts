import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  badRequest,
  forbidden,
  requireMembership,
  unauthorized,
  handleError,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeAgent } from "@/lib/serialize";

// GET /api/agents?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId is required");

    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const agents = await db.agent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return ok(agents.map(serializeAgent));
  } catch (err) {
    return handleError("GET /api/agents", err);
  }
}

// POST /api/agents — create an AI agent (admin/owner only)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = await req.json();
    const {
      workspaceId,
      name,
      displayName,
      provider,
      model,
      role,
      systemPrompt,
    } = body;
    if (!workspaceId || !name || !displayName || !provider || !model)
      return badRequest(
        "workspaceId, name, displayName, provider, model required",
      );

    const memberRole = await requireMembership(user.id, workspaceId);
    if (!canManageWorkspace(memberRole))
      return forbidden("Only admins/owners can manage agents");

    const agent = await db.agent.create({
      data: {
        workspaceId,
        name: String(name).toLowerCase(),
        displayName,
        provider,
        model,
        role: role ?? "Teammate",
        systemPrompt: systemPrompt ?? "",
      },
    });
    return ok(serializeAgent(agent), { status: 201 });
  } catch (err) {
    return handleError("POST /api/agents", err);
  }
}
