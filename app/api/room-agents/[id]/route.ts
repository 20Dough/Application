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

type Params = { params: Promise<{ id: string }> };

// DELETE /api/room-agents/[id] — remove an agent from a room
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const roomAgent = await db.roomAgent.findUnique({
      where: { id },
      include: { room: true },
    });
    if (!roomAgent) return notFound("Room agent not found");

    const role = await requireMembership(user.id, roomAgent.room.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can manage room agents");

    await db.roomAgent.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/room-agents/:id]", err);
    return serverError();
  }
}
