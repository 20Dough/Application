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
import { canManageWorkspace, getMemberRole } from "@/lib/permissions";
import { serializeRoom } from "@/lib/serialize";
import { hashPasscode } from "@/lib/rooms/passcode";

type Params = { params: Promise<{ roomId: string }> };

// GET /api/rooms/[roomId]
export async function GET(_req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!role) return forbidden("Not a member of this workspace");
    return ok(serializeRoom(room));
  } catch (err) {
    return handleError("GET /api/rooms/:id", err);
  }
}

// PATCH /api/rooms/[roomId]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can update rooms");

    const { name, description, defaultAgentId, passcode } = await req.json();

    // Passcode changes are restricted to the room's creator (or, if the room
    // predates creator tracking, the workspace owner).
    let passcodeData:
      | { passcodeHash: string | null; passcodeSalt: string | null }
      | undefined;
    if (passcode !== undefined) {
      const isCreator = room.createdById
        ? room.createdById === user.id
        : (await getMemberRole(user.id, room.workspaceId)) === "owner";
      if (!isCreator)
        return forbidden("Only the room creator can set the passcode");

      if (passcode === null || passcode === "") {
        passcodeData = { passcodeHash: null, passcodeSalt: null };
      } else {
        const { hash, salt } = hashPasscode(String(passcode));
        passcodeData = { passcodeHash: hash, passcodeSalt: salt };
      }
    }

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
        ...(passcodeData ?? {}),
      },
    });
    return ok(serializeRoom(updated));
  } catch (err) {
    return handleError("PATCH /api/rooms/:id", err);
  }
}

// DELETE /api/rooms/[roomId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) return notFound("Room not found");

    const role = await requireMembership(user.id, room.workspaceId);
    if (!canManageWorkspace(role))
      return forbidden("Only admins/owners can delete rooms");

    await db.room.delete({ where: { id: roomId } });
    return ok({ deleted: true });
  } catch (err) {
    return handleError("DELETE /api/rooms/:id", err);
  }
}
