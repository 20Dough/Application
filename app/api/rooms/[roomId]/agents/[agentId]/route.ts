import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageRooms,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";

type RouteContext = {
  params: Promise<{ roomId: string; agentId: string }>;
};

// DELETE /api/rooms/[roomId]/agents/[agentId]
// Removes an AI agent from the room. Owners/admins only. If the removed agent
// was the room's default, the default is cleared in the same transaction.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId, agentId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);
    if (!canManageRooms(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage room agents");
    }

    const link = await db.roomAgent.findUnique({
      where: { roomId_agentId: { roomId, agentId } },
    });
    if (!link) {
      return NextResponse.json(
        { error: "Agent is not in this room" },
        { status: 404 }
      );
    }

    // Removing the default agent must also clear the room's default so it never
    // points at an agent that is no longer in the room.
    await db.$transaction([
      db.roomAgent.delete({
        where: { roomId_agentId: { roomId, agentId } },
      }),
      ...(room.defaultAgentId === agentId
        ? [
            db.room.update({
              where: { id: roomId },
              data: { defaultAgentId: null },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
