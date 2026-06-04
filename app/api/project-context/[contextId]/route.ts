import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  forbidden,
  notFound,
  requireMembership,
  unauthorized,
  handleError,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeProjectContext } from "@/lib/serialize";

type Params = { params: Promise<{ contextId: string }> };

// PATCH /api/project-context/[contextId]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { contextId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const item = await db.projectContext.findUnique({
      where: { id: contextId },
    });
    if (!item) return notFound("Project context not found");

    const role = await requireMembership(user.id, item.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage project context");

    const { title, content } = await req.json();
    const updated = await db.projectContext.update({
      where: { id: contextId },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
      },
    });
    return ok(serializeProjectContext(updated));
  } catch (err) {
    return handleError("PATCH /api/project-context/:id", err);
  }
}

// DELETE /api/project-context/[contextId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { contextId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const item = await db.projectContext.findUnique({
      where: { id: contextId },
    });
    if (!item) return notFound("Project context not found");

    const role = await requireMembership(user.id, item.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage project context");

    await db.projectContext.delete({ where: { id: contextId } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError("DELETE /api/project-context/:id", err);
  }
}
