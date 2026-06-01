import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ok,
  forbidden,
  notFound,
  serverError,
  requireMembership,
} from "@/lib/api";
import { canManageWorkspace } from "@/lib/permissions";
import { serializeMemory } from "@/lib/serialize";

type Params = { params: Promise<{ memoryId: string }> };

// PATCH /api/memory/[memoryId]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { memoryId } = await params;
    const user = await getCurrentUser();
    const item = await db.memoryItem.findUnique({ where: { id: memoryId } });
    if (!item) return notFound("Memory item not found");

    const role = await requireMembership(user.id, item.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage memory");

    const { title, content, importance } = await req.json();
    const updated = await db.memoryItem.update({
      where: { id: memoryId },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
        ...(importance !== undefined
          ? { importance: Number(importance) || 1 }
          : {}),
      },
    });
    return ok(serializeMemory(updated));
  } catch (err) {
    console.error("[PATCH /api/memory/:id]", err);
    return serverError();
  }
}

// DELETE /api/memory/[memoryId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { memoryId } = await params;
    const user = await getCurrentUser();
    const item = await db.memoryItem.findUnique({ where: { id: memoryId } });
    if (!item) return notFound("Memory item not found");

    const role = await requireMembership(user.id, item.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage memory");

    await db.memoryItem.delete({ where: { id: memoryId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/memory/:id]", err);
    return serverError();
  }
}
