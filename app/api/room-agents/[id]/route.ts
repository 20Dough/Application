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
import { canAccessRoom } from "@/lib/rooms/passcode";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/room-agents/[id] — remove an agent from a room
export async function DELETE(req: Request, { params }: Params) {
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
    if (!canAccessRoom(roomAgent.room, req)) return forbidden("Room is locked");

    await db.roomAgent.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError("DELETE /api/room-agents/:id", err);
  }
}
