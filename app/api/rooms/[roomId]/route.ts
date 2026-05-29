import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageRooms,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateRoomUpdate } from "@/lib/rooms/validation";

type RouteContext = { params: Promise<{ roomId: string }> };

// Shape used when presenting an agent in a room context.
const AGENT_SELECT = {
  id: true,
  name: true,
  displayName: true,
  provider: true,
  model: true,
  role: true,
  avatarUrl: true,
  isActive: true,
} as const;

// GET /api/rooms/[roomId]
// Returns a room with its participants: the workspace's human members (a room's
// humans are simply the workspace's humans) and the AI agents added to the room,
// plus the workspace agents still available to add. Any workspace member may
// view; the current user's role is returned so the UI can gate controls.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);

    const [members, roomAgents, workspaceAgents] = await Promise.all([
      // Human members of the room = the workspace's human members.
      db.workspaceMember.findMany({
        where: { workspaceId: room.workspaceId },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      // AI agents currently in the room.
      db.roomAgent.findMany({
        where: { roomId },
        include: { agent: { select: AGENT_SELECT } },
        orderBy: { createdAt: "asc" },
      }),
      // All AI agents in the workspace (used to compute who can still be added).
      db.agent.findMany({
        where: { workspaceId: room.workspaceId },
        select: AGENT_SELECT,
        orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
      }),
    ]);

    const inRoom = new Set(roomAgents.map((ra) => ra.agent.id));
    const availableAgents = workspaceAgents.filter((a) => !inRoom.has(a.id));

    return NextResponse.json({
      room: {
        id: room.id,
        workspaceId: room.workspaceId,
        name: room.name,
        description: room.description,
        defaultAgentId: room.defaultAgentId,
        createdAt: room.createdAt,
      },
      members,
      agents: roomAgents.map((ra) => ra.agent),
      availableAgents,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/rooms/[roomId]
// Updates a room's name/description and/or its default agent. Owners/admins
// only. Setting defaultAgentId requires the agent to be a member of the room;
// passing null clears the default.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);
    if (!canManageRooms(membership.role)) {
      throw new ForbiddenError("Only owners and admins can edit rooms");
    }

    const body = await request.json().catch(() => null);
    const b = (body ?? {}) as Record<string, unknown>;

    const data: { name?: string; description?: string | null; defaultAgentId?: string | null } = {};

    // Name / description go through the pure validator when present.
    if (b.name !== undefined || b.description !== undefined) {
      const result = validateRoomUpdate(b);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      Object.assign(data, result.data);
    }

    // Default agent is validated here because it needs the database: the agent
    // must already be a member of this room. null clears the default.
    if (b.defaultAgentId !== undefined) {
      if (b.defaultAgentId === null) {
        data.defaultAgentId = null;
      } else if (typeof b.defaultAgentId === "string") {
        const link = await db.roomAgent.findUnique({
          where: { roomId_agentId: { roomId, agentId: b.defaultAgentId } },
        });
        if (!link) {
          return NextResponse.json(
            { error: "The default agent must be a member of the room" },
            { status: 400 }
          );
        }
        data.defaultAgentId = b.defaultAgentId;
      } else {
        return NextResponse.json(
          { error: "defaultAgentId must be an agent id or null" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.room.update({ where: { id: roomId }, data });

    return NextResponse.json({ room: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/rooms/[roomId]
// Deletes a room. Owners/admins only. Room agents, messages, etc. cascade away
// via the schema.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);
    if (!canManageRooms(membership.role)) {
      throw new ForbiddenError("Only owners and admins can delete rooms");
    }

    await db.room.delete({ where: { id: roomId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
