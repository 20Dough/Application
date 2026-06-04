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
import { canManageWorkspace, roleAtLeast } from "@/lib/permissions";
import { serializeWorkspace } from "@/lib/serialize";

type Params = { params: Promise<{ workspaceId: string }> };

// GET /api/workspaces/[workspaceId]
export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const role = await requireMembership(user.id, workspaceId);
    if (!role) return forbidden("Not a member of this workspace");

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) return notFound("Workspace not found");
    return ok(serializeWorkspace(workspace));
  } catch (err) {
    console.error("[GET /api/workspaces/:id]", err);
    return serverError();
  }
}

// PATCH /api/workspaces/[workspaceId]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const role = await requireMembership(user.id, workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can update the workspace");

    const { name, description } = await req.json();
    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
      },
    });
    return ok(serializeWorkspace(workspace));
  } catch (err) {
    console.error("[PATCH /api/workspaces/:id]", err);
    return serverError();
  }
}

// DELETE /api/workspaces/[workspaceId] — owner only
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const role = await requireMembership(user.id, workspaceId);
    if (!roleAtLeast(role, "owner"))
      return forbidden("Only the owner can delete the workspace");

    await db.workspace.delete({ where: { id: workspaceId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/workspaces/:id]", err);
    return serverError();
  }
}
