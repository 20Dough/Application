import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageRooms,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";

type RouteContext = { params: Promise<{ roomId: string }> };

// POST /api/rooms/[roomId]/agents
// Adds an AI agent to the room. Owners/admins only. The agent must belong to
// the same workspace as the room. Adding an agent already in the room is a 409.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { roomId } = await params;

    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const membership = await requireWorkspaceMember(user.id, room.workspaceId);
    if (!canManageRooms(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage room agents");
    }

    const body = await request.json().catch(() => null);
    const agentId = typeof body?.agentId === "string" ? body.agentId : "";
    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    // The agent must exist and live in the same workspace as the room.
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.workspaceId !== room.workspaceId) {
      return NextResponse.json(
        { error: "Agent not found in this workspace" },
        { status: 404 }
      );
    }

    const existing = await db.roomAgent.findUnique({
      where: { roomId_agentId: { roomId, agentId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `${agent.displayName} is already in this room` },
        { status: 409 }
      );
    }

    const roomAgent = await db.roomAgent.create({
      data: { roomId, agentId },
    });

    return NextResponse.json({ roomAgent }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
