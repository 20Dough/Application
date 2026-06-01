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
import { serializeRoom } from "@/lib/serialize";

type Params = { params: Promise<{ roomId: string }> };

// GET /api/rooms/[roomId]
export async function GET(_req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");
    return ok(serializeRoom(room));
  } catch (err) {
    console.error("[GET /api/rooms/:id]", err);
    return serverError();
  }
}

// PATCH /api/rooms/[roomId]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can update rooms");

    const { name, description, defaultAgentId } = await req.json();
    const updated = await db.room.update({
      where: { id: roomId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
        ...(defaultAgentId !== undefined
          ? { defaultAgentId: defaultAgentId || null }
          : {}),
      },
    });
    return ok(serializeRoom(updated));
  } catch (err) {
    console.error("[PATCH /api/rooms/:id]", err);
    return serverError();
  }
}

// DELETE /api/rooms/[roomId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can delete rooms");

    await db.room.delete({ where: { id: roomId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/rooms/:id]", err);
    return serverError();
  }
}
