import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  requireWorkspaceMember,
  canManageMemory,
  ForbiddenError,
} from "@/lib/permissions";
import { errorResponse } from "@/lib/api";
import { validateMemoryCreate } from "@/lib/memory/validation";

// GET /api/memory?workspaceId=[&roomId=]
// Lists the shared memory items in a workspace. Any member may view memory — it
// feeds the AI context their own messages rely on. An optional roomId narrows
// the list to that room's items plus workspace-wide items (roomId null). Also
// returns the caller's role so the UI can gate management controls.
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

    const roomId = request.nextUrl.searchParams.get("roomId");
    const where = roomId
      ? { workspaceId, OR: [{ roomId: null }, { roomId }] }
      : { workspaceId };

    const memoryItems = await db.memoryItem.findMany({
      where,
      // Most important first, then newest — matches how the context builder
      // prioritizes them.
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      memoryItems,
      role: membership.role,
      currentUserId: user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/memory
// Creates a shared memory item in a workspace. Owners/admins only. An optional
// roomId scopes the item to a single room; it is validated to belong to the
// workspace so memory can never leak across workspaces.
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
    if (!canManageMemory(membership.role)) {
      throw new ForbiddenError("Only owners and admins can manage memory");
    }

    const result = validateMemoryCreate(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // If scoped to a room, confirm the room belongs to this workspace.
    if (result.data.roomId) {
      const room = await db.room.findUnique({
        where: { id: result.data.roomId },
        select: { workspaceId: true },
      });
      if (!room || room.workspaceId !== workspaceId) {
        return NextResponse.json(
          { error: "Room does not belong to this workspace" },
          { status: 400 }
        );
      }
    }

    const memoryItem = await db.memoryItem.create({
      data: { ...result.data, workspaceId },
    });

    return NextResponse.json({ memoryItem }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
