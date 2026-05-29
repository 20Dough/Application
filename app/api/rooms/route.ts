import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageRooms,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateRoomCreate } from "@/lib/rooms/validation";

// GET /api/rooms?workspaceId=
// Lists the rooms in a workspace. Any member may view the list. Also returns
// the current user's role so the UI can gate management controls.
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);

    const rooms = await db.room.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: {
        defaultAgent: {
          select: { id: true, name: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { roomAgents: true } },
      },
    });

    const shaped = rooms.map((room) => ({
      id: room.id,
      workspaceId: room.workspaceId,
      name: room.name,
      description: room.description,
      defaultAgentId: room.defaultAgentId,
      defaultAgent: room.defaultAgent,
      agentCount: room._count.roomAgents,
      createdAt: room.createdAt,
    }));

    return NextResponse.json({
      rooms: shaped,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/rooms
// Creates a new room in a workspace. Owners/admins only.
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!canManageRooms(membership.role)) {
      throw new ForbiddenError("Only owners and admins can create rooms");
    }

    const result = validateRoomCreate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const room = await db.room.create({
      data: { ...result.data, workspaceId },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
